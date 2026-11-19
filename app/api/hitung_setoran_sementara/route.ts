import { NextResponse } from 'next/server';

/**
 * ALFASTORE / SISA - Hitung Setoran Sementara (read-only)
 * Deploy: app/api/hitung_setoran_sementara/route.ts
 *
 * GET /api/hitung_setoran_sementara?storeId=M604&userId=25045609&processDate=19-11-2026&dcId=MZ01
 *
 * CATATAN PENTING:
 * - URL/query memilih data yang dicari.
 * - Store-Id/User-Id header merupakan identitas yang diterima sistem upstream.
 * - Kesalahan 400 dengan kode AHO berasal dari server upstream dan tidak dapat
 *   diperbaiki dengan mengganti kode proxy bila izin/sesi/backend belum benar.
 * - Jangan gunakan identitas dari toko/operator lain tanpa otorisasi.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALFASTORE_ENDPOINT =
  'https://app.alfastore.co.id/prd/api/sis/proses/hitung_setoran_sementara/get_data';

// Semua header dikonstruksi dalam satu route.ts, tanpa membocorkannya ke browser.
// Kunci dari tangkapan layar pengguna; rotasi dan pindahkan ke SIS_API_KEY untuk produksi.
const DEFAULT_API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const APP_NAME = 'InventoryIntelligence';

function respond(payload: unknown, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function validDate(value: string) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [dd, mm, yyyy] = value.split('-').map(Number);
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  return date.getUTCDate() === dd && date.getUTCMonth() === mm - 1 && date.getUTCFullYear() === yyyy;
}

function extractMessage(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  const obj = result as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  return '';
}

export async function GET(request: Request) {
  const requiredProxyToken = process.env.PROXY_TOKEN?.trim();
  if (requiredProxyToken && request.headers.get('x-proxy-token') !== requiredProxyToken) {
    return respond({ success: false, message: 'Token akses proxy tidak valid.' }, 401);
  }

  const query = new URL(request.url).searchParams;
  const storeId = (query.get('storeId') || '').trim().toUpperCase();
  const userId = (query.get('userId') || '').trim();
  const processDate = (query.get('processDate') || '').trim();
  const dcId = (query.get('dcId') || '').trim().toUpperCase();

  if (!/^[A-Z0-9]{4}$/.test(storeId)) {
    return respond({ success: false, message: 'storeId wajib 4 huruf/angka.' }, 400);
  }
  if (!/^\d{8}$/.test(userId)) {
    return respond({ success: false, message: 'userId wajib berupa NIK 8 digit.' }, 400);
  }
  if (!validDate(processDate)) {
    return respond({ success: false, message: 'processDate harus dd-mm-yyyy yang valid.' }, 400);
  }
  if (!/^[A-Z0-9]{2,8}$/.test(dcId)) {
    return respond({ success: false, message: 'dcId tidak valid.' }, 400);
  }

  // DEFAULT DISELARASKAN dengan target. Jika operator yang sah berbeda,
  // atur SIS_HEADER_STORE_ID dan SIS_HEADER_USER_ID di Vercel.
  // Hindari hard-code M865/20020884 ketika meminta M604 tanpa otorisasi.
  const headerStoreId = (process.env.SIS_HEADER_STORE_ID?.trim() || storeId).toUpperCase();
  const headerUserId = process.env.SIS_HEADER_USER_ID?.trim() || userId;
  const headerBranchId = (process.env.SIS_BRANCH_ID?.trim() || dcId).toUpperCase();
  const apiKey = process.env.SIS_API_KEY?.trim() || DEFAULT_API_KEY;

  const url = new URL(ALFASTORE_ENDPOINT);
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('userId', userId);
  url.searchParams.set('processDate', processDate);
  url.searchParams.set('dcId', dcId);

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': apiKey,
    'App-Name': APP_NAME,
    Platform: 'ANDROID',
    'Store-Id': headerStoreId,
    'User-Id': headerUserId,
    'Branch-Id': headerBranchId,
    Connection: 'Keep-Alive',
    'Accept-Encoding': 'gzip',
    // Host otomatis mengikuti URL https://app.alfastore.co.id
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: upstreamHeaders,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = await upstream.text();
    let data: unknown = null;
    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      return respond({
        success: false,
        upstreamStatus: upstream.status,
        message: 'Respons ALFASTORE bukan JSON. Periksa sesi, reverse proxy, dan status server.',
      }, 502);
    }

    const message = extractMessage(data);
    const ahoCode = message.match(/\b[A-Z0-9]{4}_\d{8}_[A-Za-z0-9]+_[A-Za-z0-9]+\b/)?.[0] || null;
    const identityDiffers = storeId !== headerStoreId;

    return respond({
      success: upstream.ok,
      upstreamStatus: upstream.status,
      storeId,
      userId,
      processDate,
      dcId,
      requestIdentity: {
        headerStoreId,
        headerUserId,
        headerBranchId,
        storeIdMismatch: identityDiffers,
      },
      data,
      ...(ahoCode ? {
        ahoCode,
        explanation: 'ALFASTORE mengembalikan kode AHO. Ini masalah yang dilaporkan upstream, bukan kesalahan parser JSON. Periksa akses operator yang sah, kecocokan data toko/NIK/tanggal, dan laporkan kode AHO ke dukungan ALFASTORE. Mengubah header tidak menjamin menghilangkan AHO.',
      } : {}),
    }, upstream.status);
  } catch (error: unknown) {
    const wasTimeout = error instanceof Error && error.name === 'AbortError';
    console.error('hitung_setoran_sementara:', wasTimeout ? 'ALFASTORE timeout' : 'koneksi upstream gagal');
    return respond({
      success: false,
      message: wasTimeout
        ? 'ALFASTORE tidak merespons sebelum batas waktu 20 detik.'
        : 'Gagal terhubung ke ALFASTORE.',
    }, wasTimeout ? 504 : 502);
  } finally {
    clearTimeout(timeout);
  }
}
