import { NextResponse } from 'next/server';

/**
 * Vercel App Router: app/api/hitung_setoran_sementara/route.ts
 *
 * Contoh GET:
 * /api/hitung_setoran_sementara?storeId=M604&userId=25045609&processDate=19-11-2026&dcId=MZ01
 *
 * Penting:
 * - Parameter URL = data toko/kasir yang diminta.
 * - Header Store-Id dan User-Id = identitas operator sesi API.
 * - Jangan otomatis menyamakan keduanya; screenshot menunjukkan nilai berbeda.
 * - Error 400/AHO dari ALFASTORE tidak dapat dihilangkan dengan mengubah kode proxy saja.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_URL =
  'https://app.alfastore.co.id/prd/api/sis/proses/hitung_setoran_sementara/get_data';

// Header disimpan di sisi server dalam route.ts, tidak masuk HTML/browser.
// Untuk produksi, gunakan environment variable Vercel agar key dapat dirotasi.
const API_KEY = process.env.SIS_API_KEY?.trim() || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const DEFAULT_OPERATOR_STORE_ID = 'M865'; // Store-Id dari screenshot
const DEFAULT_OPERATOR_USER_ID = '20020884'; // User-Id dari screenshot
const DEFAULT_BRANCH_ID = 'MZ01'; // Branch-Id dari screenshot

const commonResponseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: commonResponseHeaders,
  });
}

function validDateDDMMYYYY(value: string): boolean {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function messageFromPayload(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const data = payload as Record<string, unknown>;
    const message = data.message ?? data.error ?? data.msg;
    if (typeof message === 'string') return message;
  }
  return '';
}

export async function GET(request: Request) {
  const requiredToken = process.env.PROXY_TOKEN?.trim();
  if (requiredToken && request.headers.get('x-proxy-token') !== requiredToken) {
    return json({ success: false, message: 'Akses proxy ditolak.' }, 401);
  }

  const params = new URL(request.url).searchParams;
  const storeId = (params.get('storeId') ?? '').trim().toUpperCase();
  const userId = (params.get('userId') ?? '').trim();
  const processDate = (params.get('processDate') ?? '').trim();
  const dcId = (params.get('dcId') ?? DEFAULT_BRANCH_ID).trim().toUpperCase();

  if (!/^[A-Z0-9]{4}$/.test(storeId)) {
    return json({ success: false, message: 'storeId harus 4 karakter huruf/angka.' }, 400);
  }
  if (!/^\d{8}$/.test(userId)) {
    return json({ success: false, message: 'userId harus NIK 8 digit.' }, 400);
  }
  if (!validDateDDMMYYYY(processDate)) {
    return json({ success: false, message: 'processDate harus tanggal dd-mm-yyyy yang valid.' }, 400);
  }
  if (!/^[A-Z0-9]{2,8}$/.test(dcId)) {
    return json({ success: false, message: 'dcId tidak valid.' }, 400);
  }

  const operatorStoreId = (process.env.SIS_HEADER_STORE_ID?.trim() || DEFAULT_OPERATOR_STORE_ID).toUpperCase();
  const operatorUserId = process.env.SIS_HEADER_USER_ID?.trim() || DEFAULT_OPERATOR_USER_ID;
  const branchId = (process.env.SIS_BRANCH_ID?.trim() || dcId).toUpperCase();

  const upstream = new URL(UPSTREAM_URL);
  upstream.searchParams.set('storeId', storeId);
  upstream.searchParams.set('userId', userId);
  upstream.searchParams.set('processDate', processDate);
  upstream.searchParams.set('dcId', dcId);

  // Semua header dari screenshot. Host ditetapkan otomatis oleh fetch.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': API_KEY,
    'App-Name': 'InventoryIntelligence',
    'Platform': 'ANDROID',
    'Store-Id': operatorStoreId,
    'User-Id': operatorUserId,
    'Branch-Id': branchId,
    'Connection': 'Keep-Alive',
    'Accept-Encoding': 'gzip',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(upstream.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });

    const body = await response.text();
    let data: unknown;
    try {
      data = body ? JSON.parse(body) : null;
    } catch {
      return json({
        success: false,
        upstreamStatus: response.status,
        message: 'ALFASTORE mengembalikan respons bukan JSON.',
        responsePreview: body.slice(0, 300),
      }, 502);
    }

    const upstreamMessage = messageFromPayload(data);
    const ahoMatch = upstreamMessage.match(/\b[A-Z0-9]{4}_\d{8}_[A-Za-z0-9]+_[A-Za-z0-9]+\b/);
    const ahoCode = ahoMatch ? ahoMatch[0] : null;

    return json({
      success: response.ok,
      upstreamStatus: response.status,
      storeId,
      userId,
      processDate,
      dcId,
      requestIdentity: { // diagnostic; tidak memuat API key
        headerStoreId: operatorStoreId,
        headerUserId: operatorUserId,
        headerBranchId: branchId,
      },
      data,
      ...(ahoCode ? {
        ahoCode,
        explanation: 'Server ALFASTORE mengembalikan kode AHO. Ini bukan kesalahan format JSON proxy. Periksa izin toko/NIK/tanggal, kecocokan sesi/header, atau hubungi dukungan resmi dengan kode AHO tersebut. Jangan terus mengulang request.',
      } : {}),
    }, response.status);
  } catch (err: unknown) {
    const timeout = err instanceof Error && err.name === 'AbortError';
    console.error('ALFASTORE hitung_setoran_sementara:', timeout ? 'timeout' : err);
    return json({
      success: false,
      message: timeout ? 'Server ALFASTORE tidak merespons dalam 20 detik.' : 'Koneksi ke server ALFASTORE gagal.',
    }, timeout ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
