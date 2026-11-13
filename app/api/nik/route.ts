// Next.js App Router: app/api/inventory/route.ts
// Konfigurasi API ditempatkan dalam satu file, tanpa .env.
// Penting: file ini harus berjalan di SERVER (jangan dipakai di komponen client).

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Semua konfigurasi langsung di route.ts.
const API_BASE_URL = 'https://app.alfastore.co.id/prd/api/sis/master/inventory/lov_items';
const API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const APP_NAME = 'InventoryIntelligence';
const PLATFORM = 'ANDROID';
const USER_ID = '20020884';
const BRANCH_ID = 'MZ01';
const DEFAULT_STORE_ID = 'M865';
const DEFAULT_SEARCH_VALUE = '427285';

export async function GET(request: NextRequest) {
  const storeId = (request.nextUrl.searchParams.get('storeId') ?? DEFAULT_STORE_ID).trim();
  const searchValue = (request.nextUrl.searchParams.get('searchValue') ?? DEFAULT_SEARCH_VALUE).trim();

  // Validasi agar nilai dari URL tidak diteruskan sembarangan ke layanan upstream.
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(storeId)) {
    return NextResponse.json({ success: false, error: 'storeId tidak valid' }, { status: 400 });
  }

  if (searchValue.length === 0 || searchValue.length > 100) {
    return NextResponse.json({ success: false, error: 'searchValue tidak valid' }, { status: 400 });
  }

  const upstreamUrl = new URL(API_BASE_URL);
  upstreamUrl.searchParams.set('storeId', storeId);
  upstreamUrl.searchParams.set('searchValue', searchValue);

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'python-requests/2.28.2',
        'Api-Key': API_KEY,
        'App-Name': APP_NAME,
        'Platform': PLATFORM,
        'Store-Id': storeId,
        'User-Id': USER_ID,
        'Branch-Id': BRANCH_ID,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json(
      {
        success: false,
        error: timedOut ? 'Koneksi API melewati batas waktu' : 'Gagal terhubung ke API upstream',
      },
      { status: timedOut ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
