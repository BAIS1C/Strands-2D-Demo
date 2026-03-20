/**
 * /api/soundwave/* — Vercel Edge Proxy to ACE-Step API
 *
 * Forwards requests from the SoundWave applet (StepStudio iframe)
 * to the local ACE-Step server via Cloudflare Tunnel.
 *
 * Browser never sees the tunnel URL. Rate limiting enforced here.
 *
 * Env vars:
 *   SOUNDWAVE_API_URL  — e.g. https://soundwave-api.strandsnation.xyz
 *   SOUNDWAVE_API_KEY  — optional auth key for the ACE-Step API
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.SOUNDWAVE_API_URL;
const API_KEY = process.env.SOUNDWAVE_API_KEY;

/* ── Rate limiter (in-memory, per-IP, resets hourly) ── */
const rateMap = new Map<string, { count: number; resetAt: number }>();
const MAX_GENS_PER_HOUR = 5;
const RATE_LIMIT_ENDPOINTS = ['/release_task', '/create_random_sample'];

function isRateLimited(ip: string, path: string): boolean {
  if (!RATE_LIMIT_ENDPOINTS.some((ep) => path.endsWith(ep))) return false;

  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + 3600_000 });
    return false;
  }

  entry.count++;
  return entry.count > MAX_GENS_PER_HOUR;
}

/* ── Demo constraints ── */
const MAX_DURATION = 30; // seconds

function enforceDemoConstraints(body: Record<string, unknown>): Record<string, unknown> {
  return {
    ...body,
    audio_duration: Math.min(Number(body.audio_duration) || 15, MAX_DURATION),
    batch_size: 1,
    // Force turbo model only in demo
  };
}

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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // Rate limit generation endpoints
  if (isRateLimited(ip, targetPath)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 5 generations per hour in demo mode.' },
      { status: 429 }
    );
  }

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

  // Handle body — enforce demo constraints on generation requests
  let body: BodyInit | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const json = await req.json();
      const constrained = RATE_LIMIT_ENDPOINTS.some((ep) => targetPath.endsWith(ep))
        ? enforceDemoConstraints(json)
        : json;
      body = JSON.stringify(constrained);
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
