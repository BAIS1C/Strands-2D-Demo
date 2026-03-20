/**
 * /api/soundwave/* — Vercel Edge Proxy to ACE-Step API
 *
 * Forwards requests from the SoundWave applet (StepStudio iframe)
 * to the local ACE-Step server via Cloudflare Tunnel.
 *
 * Browser never sees the tunnel URL. No rate limits — server owner
 * controls availability by starting/stopping the tunnel.
 *
 * Env vars:
 *   SOUNDWAVE_API_URL  — e.g. https://soundwave-api.strandsnation.xyz
 *   SOUNDWAVE_API_KEY  — optional auth key for the ACE-Step API
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.SOUNDWAVE_API_URL;
const API_KEY = process.env.SOUNDWAVE_API_KEY;

/* ── Proxy handler ── */
async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!API_URL) {
    return NextResponse.json(
      { error: 'SoundWave API not configured' },
      { status: 503 }
    );
  }

  const { path } = await params;
  const targetPath = '/' + path.join('/');

  // Build upstream URL (preserve query string)
  const url = new URL(targetPath, API_URL);
  const searchParams = req.nextUrl.searchParams;
  searchParams.forEach((value, key) => url.searchParams.set(key, value));

  // Build headers — use API_KEY if set, otherwise forward the client's token
  const headers: HeadersInit = {};
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  } else {
    // Forward client auth token so server-side auth works
    const clientAuth = req.headers.get('authorization');
    if (clientAuth) {
      headers['Authorization'] = clientAuth;
    }
  }
  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Forward request body as-is (no constraints — server owner controls availability)
  let body: BodyInit | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const json = await req.json();
      body = JSON.stringify(json);
    } catch {
      body = null;
    }
  }

  try {
    const upstream = await fetch(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    // Stream audio responses directly
    const upstreamContentType = upstream.headers.get('content-type') || '';
    if (upstreamContentType.includes('audio') || targetPath.startsWith('/v1/audio')) {
      const audioData = await upstream.arrayBuffer();
      return new NextResponse(audioData, {
        status: upstream.status,
        headers: {
          'Content-Type': upstreamContentType || 'audio/wav',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // JSON responses
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('[SoundWave proxy]', err);
    return NextResponse.json(
      { error: 'SoundWave API unreachable. The generation server may be offline.' },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
