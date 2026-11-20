/**
 * ALFASTORE - Cetak Ulang Struk Kasir
 * Next.js App Router / Vercel
 * Simpan sebagai: app/api/cetak_ulang_struk/route.ts
 *
 * Contoh pemakaian:
 * GET /api/cetak_ulang_struk?storeId=M604&nik=25045609&noBon=M604-808-1011X5M3
 *
 * Seluruh konfigurasi header ada di file ini, pada buildHeaders().
 * Route ini meneruskan request GET ke endpoint yang diberikan pengguna;
 * metode dan akses endpoint upstream belum terverifikasi.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_ENDPOINT =
  'https://app.alfastore.co.id/prd/api/sis/transaksi/cetak_ulang_struk';

// Nilai berikut disalin dari contoh header pengguna.
// Untuk deployment permanen, pindahkan kunci ke ALFASTORE_API_KEY
// pada environment variables Vercel, kemudian hapus fallback di bawah.
const API_KEY =
  process.env.ALFASTORE_API_KEY || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';

// User-Id HEADER adalah identitas operator, BUKAN NIK kasir yang dicari.
const HEADER_USER_ID = process.env.ALFASTORE_USER_ID || '20020884';
const HEADER_BRANCH_ID = process.env.ALFASTORE_BRANCH_ID || 'MZ01';

function buildHeaders(storeId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': API_KEY,
    'App-Name': 'InventoryIntelligence',
    Platform: 'ANDROID',
    'Store-Id': storeId,
    'User-Id': HEADER_USER_ID,
    'Branch-Id': HEADER_BRANCH_ID,
    // Host diambil otomatis dari alamat URL oleh fetch().
    // Connection: keep-alive dan Accept-Encoding: gzip diurus Node.js.
  };
}

function jsonError(message: string, status: number, extra: object = {}) {
  return NextResponse.json(
    { success: false, message, ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: NextRequest) {
  // Opsional: set PROXY_ACCESS_TOKEN di Vercel untuk melindungi endpoint ini.
  // Jika diisi, pemanggil wajib mengirim header x-proxy-token.
  const proxyToken = process.env.PROXY_ACCESS_TOKEN;
  if (proxyToken && request.headers.get('x-proxy-token') !== proxyToken) {
    return jsonError('Tidak diizinkan mengakses proxy.', 401);
  }

  const search = request.nextUrl.searchParams;
  const storeId = (search.get('storeId') || '').trim().toUpperCase();
  const nik = (search.get('nik') || '').trim();
  const noBon = (search.get('noBon') || '').trim();

  if (!storeId || !nik || !noBon) {
    return jsonError('storeId, nik, dan noBon wajib diisi.', 400, {
      contoh: '/api/cetak_ulang_struk?storeId=M604&nik=25045609&noBon=M604-808-1011X5M3',
    });
  }
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) {
    return jsonError('Format storeId tidak valid.', 400);
  }
  if (!/^\d{1,12}$/.test(nik)) {
    return jsonError('Format NIK tidak valid.', 400);
  }
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(noBon)) {
    return jsonError('Format noBon tidak valid.', 400);
  }

  const url = new URL(UPSTREAM_ENDPOINT);
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('nik', nik);
  url.searchParams.set('noBon', noBon);

  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: buildHeaders(storeId),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      redirect: 'manual',
    });

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Upstream-Status': String(upstream.status),
    });

    // Jangan bocorkan request headers, API key, cookie, atau URL upstream.
    // Body dan status upstream dikembalikan apa adanya agar error mudah diperiksa.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const timeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return jsonError(
      timeout ? 'Koneksi ALFASTORE habis waktu (20 detik).' : 'Gagal menghubungi ALFASTORE.',
      timeout ? 504 : 502
    );
  }
}
