import { NextResponse } from 'next/server';

/**
 * Next.js / Vercel App Router
 * Lokasi: app/api/hitung_setoran_sementara/route.ts
 *
 * GET /api/hitung_setoran_sementara?storeId=M604&userId=23067884&processDate=19-11-2026&dcId=MZ01
 *
 * Semua header API ada di satu file ini dan dikirim dari server, bukan browser.
 * PENTING: Api-Key di bawah berasal dari tangkapan layar yang diberikan pengguna.
 * Disarankan memindahkannya ke SIS_API_KEY di Vercel setelah pengujian.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_ENDPOINT =
  'https://app.alfastore.co.id/prd/api/sis/proses/hitung_setoran_sementara/get_data';

// Header Api-Key dari gambar, tetap berada di sisi server (route.ts).
const API_KEY =
  process.env.SIS_API_KEY?.trim() || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';

const BASE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: BASE_RESPONSE_HEADERS,
  });
}

function isRealDate(value: string) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [d, m, y] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export async function GET(request: Request) {
  // Opsional: di Vercel atur PROXY_TOKEN untuk membatasi akses ke proxy ini.
  // Jika belum dikonfigurasi, proxy dapat diakses publik oleh siapa pun yang tahu URL.
  const requiredToken = process.env.PROXY_TOKEN?.trim();
  if (requiredToken && request.headers.get('x-proxy-token') !== requiredToken) {
    return json({ success: false, message: 'Akses proxy tidak diizinkan.' }, 401);
  }

  const query = new URL(request.url).searchParams;
  const storeId = (query.get('storeId') || '').trim().toUpperCase();
  const userId = (query.get('userId') || '').trim();
  const processDate = (query.get('processDate') || '').trim();
  const dcId = (query.get('dcId') || '').trim().toUpperCase();

  if (!/^[A-Z0-9]{4}$/.test(storeId)) {
    return json({ success: false, message: 'storeId wajib diisi (4 huruf/angka), contoh M604.' }, 400);
  }
  if (!/^\d{8}$/.test(userId)) {
    return json({ success: false, message: 'userId wajib berisi 8 angka NIK.' }, 400);
  }
  if (!isRealDate(processDate)) {
    return json({ success: false, message: 'processDate wajib dd-mm-yyyy (contoh 19-11-2026).' }, 400);
  }
  if (!/^[A-Z0-9]{2,8}$/.test(dcId)) {
    return json({ success: false, message: 'dcId wajib diisi, contoh MZ01.' }, 400);
  }

  const upstreamUrl = new URL(UPSTREAM_ENDPOINT);
  upstreamUrl.searchParams.set('storeId', storeId);
  upstreamUrl.searchParams.set('userId', userId);
  upstreamUrl.searchParams.set('processDate', processDate);
  upstreamUrl.searchParams.set('dcId', dcId);

  // Menyamakan header permintaan yang terlihat pada screenshot.
  // Host otomatis diatur oleh fetch sesuai URL tujuan (app.alfastore.co.id).
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': API_KEY,
    'App-Name': 'InventoryIntelligence',
    Platform: 'ANDROID',
    'Store-Id': storeId,
    'User-Id': userId,
    'Branch-Id': dcId,
    Connection: 'Keep-Alive',
    'Accept-Encoding': 'gzip',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let result: unknown;
    try {
      result = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // HTML atau respons non-JSON bisa muncul ketika proxy/auth tidak cocok.
      return json(
        {
          success: false,
          upstreamStatus: response.status,
          message: 'Server ALFASTORE mengembalikan respons bukan JSON.',
          responsePreview: rawBody.slice(0, 500),
        },
        response.ok ? 502 : response.status
      );
    }

    // Jangan kirim key/header rahasia ke klien; cukup hasil dan status server.
    return json(
      {
        success: response.ok,
        upstreamStatus: response.status,
        storeId,
        userId,
        processDate,
        dcId,
        data: result,
      },
      response.status
    );
  } catch (error: unknown) {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.error('hitung_setoran_sementara:', isTimeout ? 'request timed out' : error);
    return json(
      {
        success: false,
        message: isTimeout
          ? 'Koneksi ke ALFASTORE melewati batas 20 detik. Silakan coba lagi.'
          : 'Tidak dapat menghubungi server ALFASTORE.',
      },
      isTimeout ? 504 : 502
    );
  } finally {
    clearTimeout(timeout);
  }
}
