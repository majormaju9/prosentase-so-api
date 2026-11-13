// Simpan sebagai: app/api/penjualan_per_kasir/route.ts
// Next.js App Router (Vercel). Semua konfigurasi dalam satu file, tanpa .env.
// PENTING: endpoint ini mengakses data penjualan per kasir. Lindungi akses
// route publik ini dengan autentikasi/otorisasi sebelum digunakan produksi.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// URL dan header mengikuti contoh API Alfastore serta route.ts sebelumnya.
const API_URL = 'https://app.alfastore.co.id/prd/api/rpt/laporan/penjualan_per_kasir';
const API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const APP_NAME = 'InventoryIntelligence';
const PLATFORM = 'ANDROID';
const HEADER_USER_ID = '20020884'; // Header pemanggil API, BUKAN NIK kasir yang dicari.
const BRANCH_ID = 'MZ01';
const DEFAULT_STORE_ID = 'M604';
const DEFAULT_PERIODE1 = '13-11-2026';

function invalid(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    { status: 400, headers: { 'Cache-Control': 'no-store' } },
  );
}

function validTanggalDDMMYYYY(value: string): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const storeId = (params.get('storeId') ?? DEFAULT_STORE_ID).trim();
  const userId = (params.get('userId') ?? '').trim(); // Isi NIK_KASIR sebenarnya.
  const periode1 = (params.get('periode1') ?? DEFAULT_PERIODE1).trim();

  if (!/^[A-Za-z0-9_-]{1,20}$/.test(storeId)) {
    return invalid('storeId tidak valid');
  }
  if (!userId || !/^[A-Za-z0-9_-]{1,32}$/.test(userId)) {
    return invalid('userId wajib diisi dengan NIK kasir yang valid');
  }
  if (!validTanggalDDMMYYYY(periode1)) {
    return invalid('periode1 harus tanggal valid dengan format DD-MM-YYYY');
  }

  const url = new URL(API_URL);
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('userId', userId);
  url.searchParams.set('periode1', periode1);

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'python-requests/2.28.2',
        'Api-Key': API_KEY,
        'App-Name': APP_NAME,
        Platform: PLATFORM,
        'Store-Id': storeId,
        'User-Id': HEADER_USER_ID,
        'Branch-Id': BRANCH_ID,
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
    const timeout = error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json(
      {
        success: false,
        error: timeout ? 'Permintaan ke API melewati batas waktu' : 'Gagal menghubungi API Alfastore',
      },
      { status: timeout ? 504 : 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
