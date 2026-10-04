import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_BASE = 'https://app.alfastore.co.id/prd';
const APP_VERSION = 'V.2025.11.25.04';
const FALLBACK_API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';

type BridgeInput = {
  path?: unknown;
  body?: unknown;
  store?: unknown;
  meta?: unknown;
};

function json(status: number, data: unknown) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function scalar(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function cleanStore(value: unknown): string {
  const store = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z0-9]{4}$/.test(store) ? store : '';
}

function makeUpstreamUrl(path: string): URL | null {
  if (!path.startsWith('/api/')) return null;
  try {
    return new URL(API_BASE + path);
  } catch {
    return null;
  }
}

function isAllowedPath(path: string, store: string): boolean {
  const url = makeUpstreamUrl(path);
  if (!url) return false;

  // Prevent this endpoint from becoming an open proxy.
  if (url.origin !== new URL(API_BASE).origin) return false;

  if (url.pathname === '/prd/api/sis/master/status_toko/') {
    return (url.searchParams.get('storeId') || '').toUpperCase() === store;
  }

  if (url.pathname === '/prd/api/sis/login/') {
    return (
      url.searchParams.get('appName') === 'LpbPda' &&
      url.searchParams.get('versi') === APP_VERSION
    );
  }

  return false;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim() || '';
  return first.slice(0, 64);
}

export async function GET() {
  return json(200, {
    ok: true,
    service: 'Goods Receipt API bridge',
    version: APP_VERSION,
    endpoints: ['status_toko', 'login'],
  });
}

export async function POST(req: NextRequest) {
  let input: BridgeInput;
  try {
    input = (await req.json()) as BridgeInput;
  } catch {
    return json(400, { ok: false, message: 'Body harus berupa JSON yang valid.' });
  }

  const store = cleanStore(input.store);
  const path = typeof input.path === 'string' ? input.path.trim() : '';
  const meta = input.meta && typeof input.meta === 'object' && !Array.isArray(input.meta)
    ? (input.meta as Record<string, unknown>)
    : {};
  const body = input.body === null || input.body === undefined
    ? null
    : input.body;

  if (!store) {
    return json(400, { ok: false, message: 'Kode toko harus 4 angka/huruf.' });
  }

  if (!path || !isAllowedPath(path, store)) {
    return json(403, { ok: false, message: 'Endpoint API tidak diizinkan.' });
  }

  const apiKey = process.env.ALFASTORE_API_KEY || FALLBACK_API_KEY;
  const androidId = process.env.ALFASTORE_ANDROID_ID || '';

  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'App-Name': 'LPB-CLOUD',
    'Version-App': APP_VERSION,
    'Version-Code': '30',
    Platform: 'ANDROID',
    'Store-Id': store,
    'User-Id': '',
    'App-Uid': '',
    'Store-Id-Ext': '',
    Sn: '',
    'Api-Key': apiKey,
    AndroidId: androidId,
    'Mac-Addr': '',
    'Ip-Addr': getClientIp(req),
    'Shard-Id': scalar(meta.shardId),
    'Branch-Id': scalar(meta.dcId || meta.branchId),
    'Company-Id': '',
    'Company-Ext': '',
    'Class-Store': '',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstreamUrl = makeUpstreamUrl(path);
    if (!upstreamUrl) {
      return json(403, { ok: false, message: 'Endpoint API tidak diizinkan.' });
    }

    const upstream = await fetch(upstreamUrl, {
      method: body === null ? 'GET' : 'POST',
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
    });

    const raw = await upstream.text();
    let data: unknown;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return json(502, {
        ok: false,
        upstreamStatus: upstream.status,
        message: 'Respons server Alfastore bukan JSON yang valid.',
      });
    }

    // Always return bridge HTTP 200 when upstream responded normally.
    // The original upstream status is preserved in `upstreamStatus`, so proxy.php
    // can show the correct login/server error instead of treating the bridge itself as broken.
    return json(200, {
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      data,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return json(504, {
      ok: false,
      upstreamStatus: 0,
      message: timedOut
        ? 'Server Alfastore tidak merespons tepat waktu.'
        : 'Tidak dapat terhubung ke server Alfastore.',
    });
  } finally {
    clearTimeout(timer);
  }
}
