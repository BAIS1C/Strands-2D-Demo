# Strands: A Living World Inside Telegram

**Interactive Demo — 2D Onboarding Loop**

Strands is a retention-first game economy built on qualified, profiled user cohorts, exploiting Telegram's 1B+ distribution, built-in payments, and behavioural infrastructure.

This repo contains the alpha demo of the 2D onboarding experience: the Phase A Guided Run that introduces players to MetaXity1 through a simulated desktop operating system.

## What This Demo Includes

**Sync Profiling Flow** — Four binary narrative choices embedded in a chat-based story that map to psychometric personality axes. The system records not just what you choose, but how you engage: response latency, re-read behaviour, engagement depth. Output is a personality seed that shapes everything downstream.

**Cipher Puzzles** — Four code-breaking challenges with progressive difficulty (reverse, alternating extract, Caesar shift, compound). Performance feeds the Neuro-Kinetic Quotient (NKQ) baseline for difficulty scaling.

**Pattern Matching** — Memory game measuring cognitive processing speed and recall accuracy. Completes the NKQ assessment alongside cipher puzzle performance.

**Desktop OS Shell** — Simulated operating system interface (status bar, icon grid, window manager, taskbar) that presents game mechanics diegetically. The player never sees a tutorial; they see a desktop, a chat client, a document viewer.

**16-Track Original Soundtrack** — Procedurally loaded from `/public/audio/soundtrack/` with ID3 tag parsing.

**Telegram Mini App Integration** — Full TG WebApp API support with HMAC-SHA-256 auth validation. Automatic dev bypass on localhost for testing without Telegram.

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/game` — the dev bypass auto-activates, creating a mock TG user. Full onboarding flow plays without Telegram.

## Environment Variables

For production deployment:

| Variable | Required | Description |
|---|---|---|
| `TG_BOT_TOKEN` | Yes | Telegram bot token |
| `PLAYER_SALT` | Yes | Salt for deterministic player ID hashing |
| `KV_REST_API_URL` | No | Vercel KV endpoint (optional persistence) |
| `KV_REST_API_TOKEN` | No | Vercel KV token |

For localhost: no env vars needed. Dev bypass handles everything.

## Architecture

Next.js 14+ App Router, TypeScript, CSS Modules with CSS Custom Properties design token system. Zero runtime CSS dependencies. Server components by default, `'use client'` only where needed. All content from typed data files, never hardcoded in JSX.

See [ARCHITECTURE.md](ARCHITECTURE.md) for full technical details.

## Deploy

Designed for Vercel. Import the repo, set framework to Next.js, deploy. Add custom domain (`demo.strandsnation.xyz`) in Vercel project settings.

## Licence

Copyright (c) 2026 SomoKasane Singapore PTE. All rights reserved. See [LICENSE](LICENSE).

---

*strandsnation.xyz*
