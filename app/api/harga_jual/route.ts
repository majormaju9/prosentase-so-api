// Next.js App Router: app/api/inventory/route.ts
// Dua endpoint inventory dalam SATU file, tanpa environment variables.
// Jalankan hanya di server. Jangan import file ini ke komponen client.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Konfigurasi lengkap (hardcoded sesuai permintaan).
const API_BASE = 'https://app.alfastore.co.id/prd/api/sis/master/inventory';
const API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const APP_NAME = 'InventoryIntelligence';
const PLATFORM = 'ANDROID';
const USER_ID = '20020884';
const BRANCH_ID = 'MZ01';
const DEFAULT_STORE_ID = 'M865';

// Nilai bawaan berdasarkan dua contoh request yang diberikan.
const DEFAULT_SEARCH_VALUE = '427285';
const DEFAULT_PLU = '374';
const DEFAULT_BARCODE = '888816660355';
const DEFAULT_PAGE = '1';
const DEFAULT_LIMIT = '100';

type Endpoint = 'lov_items' | 'harga_jual';

function invalid(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Tanpa parameter endpoint: tetap memakai lov_items seperti route.ts sebelumnya.
  const endpoint = (params.get('endpoint') ?? 'lov_items') as Endpoint;

  if (endpoint !== 'lov_items' && endpoint !== 'harga_jual') {
    return invalid('endpoint harus lov_items atau harga_jual');
  }

  const storeId = (params.get('storeId') ?? DEFAULT_STORE_ID).trim();
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(storeId)) {
    return invalid('storeId tidak valid');
  }

  const upstreamUrl = new URL(`${API_BASE}/${endpoint}`);
  upstreamUrl.searchParams.set('storeId', storeId);

  if (endpoint === 'lov_items') {
    const searchValue = (params.get('searchValue') ?? DEFAULT_SEARCH_VALUE).trim();
    if (!searchValue || searchValue.length > 100) {
      return invalid('searchValue tidak valid (1–100 karakter)');
    }
    upstreamUrl.searchParams.set('searchValue', searchValue);
  } else {
    const kdStore = (params.get('kdStore') ?? storeId).trim();
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(kdStore)) {
      return invalid('kdStore tidak valid');
    }
    upstreamUrl.searchParams.set('kdStore', kdStore);

    // Jika filter produk tidak dikirim, pakai persis contoh pada screenshot.
    // Jika filter produk diubah, jangan memaksakan barcode contoh produk lain.
    const customProduct = ['plu', 'pluText', 'barcode'].some((key) => params.has(key));
    const plu = (params.get('plu') ?? (customProduct ? (params.get('pluText') ?? '') : DEFAULT_PLU)).trim();
    const pluText = (params.get('pluText') ?? plu).trim();
    const barcode = (params.get('barcode') ?? (customProduct ? '' : DEFAULT_BARCODE)).trim();

    if ([plu, pluText, barcode].some((value) => value.length > 100)) {
      return invalid('plu, pluText, atau barcode terlalu panjang');
    }
    if (plu) upstreamUrl.searchParams.set('plu', plu);
    if (pluText) upstreamUrl.searchParams.set('pluText', pluText);
    if (barcode) upstreamUrl.searchParams.set('barcode', barcode);

    const page = Number(params.get('page') ?? DEFAULT_PAGE);
    const limit = Number(params.get('limit') ?? DEFAULT_LIMIT);
    if (!Number.isSafeInteger(page) || page < 1) {
      return invalid('page harus bilangan bulat positif');
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      return invalid('limit harus bilangan bulat 1–1000');
    }
    upstreamUrl.searchParams.set('page', String(page));
    upstreamUrl.searchParams.set('limit', String(limit));
  }

  try {
    const upstream = await fetch(upstreamUrl, {
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
        // Host, Connection, Accept-Encoding diatur otomatis oleh fetch.
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

    const body = upstream.status === 204 || upstream.status === 304
      ? null
      : await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json(
      { success: false, error: timedOut ? 'Koneksi API melewati batas waktu' : 'Gagal terhubung ke API upstream' },
      { status: timedOut ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
