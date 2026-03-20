# Cloudflare Tunnel Setup — ACE Step API for SoundWave

> Connects the DemoOS SoundWave applet at `demo.strandsnation.xyz/demoOS` to your local ACE-Step 1.5 API server running on your RTX 5090.

---

## Prerequisites

- **ACE-Step 1.5** repo cloned and working locally (`ACE-Step-1.5-for-strands/`)
- **Python 3.11+** with `uv` (or pip)
- **NVIDIA GPU** with CUDA (RTX 5090 — 32GB VRAM, more than enough)
- **Cloudflare account** (free tier is fine) — only needed for named tunnels. Quick tunnels require no account.

---

## 1. Start the ACE-Step API Server

```bash
cd /path/to/ACE-Step-1.5-for-strands

# Turbo mode (DiT-only, no LLM, fastest generation, ~4GB VRAM)
ACESTEP_CONFIG_PATH=acestep-v15-turbo \
ACESTEP_INIT_LLM=false \
PORT=8001 \
uv run acestep-api
```

Verify it's running:

```bash
curl http://localhost:8001/health
# → {"status": "ok", ...}
```

### API Endpoints (reference)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check — returns model status |
| `/release_task` | POST | Submit a music generation job |
| `/query_result` | POST | Poll job status / retrieve result |
| `/v1/audio` | GET | Download generated audio file |
| `/v1/models` | GET | List available models |
| `/create_random_sample` | POST | Generate random params via LLM ("Surprise Me") |
| `/format_input` | POST | Format/enhance lyrics via LLM |

---

## 2. Install Cloudflare Tunnel (`cloudflared`)

### Linux

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### macOS

```bash
brew install cloudflared
```

### Windows

```powershell
winget install --id Cloudflare.cloudflared
```

---

## 3. Run the Tunnel

### Option A: Quick Tunnel (no account needed, random subdomain)

```bash
cloudflared tunnel --url http://localhost:8001
```

Output will show something like:

```
Your quick Tunnel has been created! Visit it at:
https://something-random-words.trycloudflare.com
```

Copy that URL — you'll set it as `SOUNDWAVE_API_URL` in Vercel.

**Downside:** URL changes every time you restart the tunnel. Fine for dev, not great for production.

### Option B: Named Tunnel (free, stable subdomain, needs Cloudflare account)

```bash
# One-time setup
cloudflared tunnel login                              # Opens browser to auth
cloudflared tunnel create soundwave-api               # Creates the tunnel
cloudflared tunnel route dns soundwave-api soundwave-api.strandsnation.xyz  # Routes your subdomain

# Run it
cloudflared tunnel run soundwave-api
```

This gives you a permanent URL: `https://soundwave-api.strandsnation.xyz` that always points to your machine when the tunnel is running.

### Option C: Named Tunnel with Config File (recommended for daily use)

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: soundwave-api
credentials-file: /home/sean/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: soundwave-api.strandsnation.xyz
    service: http://localhost:8001
  - service: http_status:404
```

Then just run:

```bash
cloudflared tunnel run
```

---

## 4. Set Vercel Environment Variable

In the Vercel dashboard for the demo site project, or in `.env.local`:

```env
SOUNDWAVE_API_URL=https://soundwave-api.strandsnation.xyz
SOUNDWAVE_API_KEY=your-optional-secret-key
```

The Vercel proxy route (`/api/soundwave/*`) reads this env var and forwards requests to your tunnel. The tunnel URL is **never exposed to the browser** — all client requests go through the Vercel proxy.

---

## 5. Test End-to-End

```bash
# 1. Health check through the tunnel
curl https://soundwave-api.strandsnation.xyz/health

# 2. Submit a generation job
curl -X POST https://soundwave-api.strandsnation.xyz/release_task \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cinematic synthwave, cyberpunk atmosphere, dark and moody",
    "lyrics": "",
    "audio_duration": 15,
    "batch_size": 1,
    "inference_steps": 8,
    "guidance_scale": 7.0,
    "vocal_language": "en",
    "task_type": "text2music"
  }'
# → {"task_id": "abc123..."}

# 3. Poll for result
curl -X POST https://soundwave-api.strandsnation.xyz/query_result \
  -H "Content-Type: application/json" \
  -d '{"task_ids": ["abc123..."]}'
# → {"results": [{"status": "complete", "audio_url": "/v1/audio?path=..."}]}

# 4. Download audio
curl https://soundwave-api.strandsnation.xyz/v1/audio?path=output/abc123.wav -o test.wav
```

---

## 6. Daily Workflow (Two Terminals)

```bash
# Terminal 1 — API server
cd ~/ACE-Step-1.5-for-strands
ACESTEP_CONFIG_PATH=acestep-v15-turbo ACESTEP_INIT_LLM=false PORT=8001 uv run acestep-api

# Terminal 2 — Tunnel
cloudflared tunnel run soundwave-api
```

Or combine them:

```bash
# One-liner (background the server, foreground the tunnel)
cd ~/ACE-Step-1.5-for-strands && \
ACESTEP_CONFIG_PATH=acestep-v15-turbo ACESTEP_INIT_LLM=false PORT=8001 uv run acestep-api &
cloudflared tunnel run soundwave-api
```

Kill both with `Ctrl+C` then `kill %1`.

---

## 7. When the Tunnel is Down

When SoundWave can't reach the API (your machine is off, tunnel not running), the StepStudio UI will show connection errors. The planned offline fallback will display pre-generated demo tracks instead — not yet implemented.

For investor demos: start both terminals before the call. Takes ~15 seconds for the API to initialise models on first run (~5 seconds on subsequent warm starts with the 5090).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `cloudflared: command not found` | Reinstall or check PATH. `which cloudflared` to verify. |
| Tunnel starts but health check fails | Make sure API server is running on port 8001 first. Check `curl http://localhost:8001/health` locally. |
| CORS errors in browser | Requests should go through the Vercel proxy (`/api/soundwave/`), never directly to the tunnel URL. If you see CORS, the client is calling the tunnel directly. |
| Slow generation | Turbo mode (`acestep-v15-turbo`) with 8 inference steps should generate 30s of audio in ~5-10 seconds on the 5090. If slower, check GPU utilisation with `nvidia-smi`. |
| `CUDA out of memory` | Shouldn't happen with DiT-only turbo on 32GB VRAM. If running other models simultaneously, close them first. |
| Random tunnel URL changed | Use a named tunnel (Option B/C above) for a stable URL. |

---

## Architecture

```
Browser (demo.strandsnation.xyz/demoOS)
  └─ SoundWave applet (StepStudio iframe)
       └─ fetch('/api/soundwave/generate')
            └─ Vercel Edge Proxy (rate limit, demo constraints)
                 └─ HTTPS → Cloudflare Tunnel
                      └─ localhost:8001 → ACE-Step FastAPI
                           └─ RTX 5090 → generated audio
```

The browser never talks to your machine directly. Vercel handles rate limiting (5 gens/hour/IP), enforces demo constraints (30s max duration, turbo model only), and proxies to the tunnel.
