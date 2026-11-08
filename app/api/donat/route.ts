/**
 * POS API read-only gateway for Next.js App Router.
 * Main: app/api/pos/route.ts (or src/app/api/pos/route.ts)
 * Alias: app/api/route.ts for the /api/ URL
 *
 * GET /api/pos                             -> public JSON catalog, HTTP 200
 * GET /api/pos?endpoint=status_toko&storeId=M604 -> upstream read, no gateway username/password
 *
 * Source endpoints are candidates from static APK analysis, not verified live URLs.
 * This gateway does NOT bypass upstream authentication/network restrictions.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Service = 'sis' | 'pos';
type EndpointSpec = {
  service: Service;
  path: string;
  required: readonly string[];
  optional?: readonly string[];
};

const BASE_URLS: Record<Service, string> = {
  sis: 'https://app.alfastore.co.id/prd/api/sis/',
  pos: 'https://app.alfastore.co.id/prd/api/pos/',
};

// GET endpoints only. Do not add payment, audit, update, or mutation endpoints here.
const ENDPOINTS = {
  status_toko: {
    service: 'sis', path: 'master/status_toko/get',
    required: ['storeId'], optional: ['dateTx'],
  },
  informasi_toko: {
    service: 'sis', path: 'master/user/get/store_info',
    required: ['storeId'],
  },
  detail_plu: {
    service: 'sis', path: 'master/ms_item/get_ms_item_by_plu',
    required: ['storeId', 'plu'], optional: ['date_tx', 'flag', 'qty', 'type', 'user_id'],
  },
  detail_pesanan: {
    service: 'pos', path: 'transaksi/transaksi_online/get_ec_order_head_det',
    required: ['storeId', 'noOrder'],
  },
  status_pesanan: {
    service: 'pos', path: 'transaksi/transaksi_online/get_ec_status_online',
    required: ['storeId', 'noOrder'], optional: ['type'],
  },
  data_transaksi_online: {
    service: 'pos', path: 'transaksi/transaksi_online/get_data_trans_online',
    required: ['storeId'], optional: ['noOrder', 'plu', 'type'],
  },
  daftar_status_online: {
    service: 'pos', path: 'transaksi/transaksi_online/get_data_lov_status_online',
    required: ['storeId'], optional: ['type'],
  },
  data_order_plu: {
    service: 'pos', path: 'transaksi/transaksi_online/get_data_ec_order_head_plu',
    required: ['storeId', 'noOrder'], optional: ['type'],
  },
  surat_jalan_online: {
    service: 'pos', path: 'transaksi/transaksi_online/get_data_ec_sj_online',
    required: ['storeId', 'noOrder'], optional: ['type'],
  },
  draft_online: {
    service: 'pos', path: 'transaksi/transaksi_online/get_ec_order_det_head_draft',
    required: ['storeId', 'noOrder'],
  },
  pesanan_cod: {
    service: 'pos', path: 'transaksi/transaksi_online/get_ec_cod_online_by_no_order',
    required: ['storeId', 'noOrder'], optional: ['type'],
  },
  tanggal_pesanan: {
    service: 'pos', path: 'transaksi/transaksi_online/get_tgl_tx_ec_order_head_by_no_order',
    required: ['storeId', 'noOrder'], optional: ['type'],
  },
  data_sapa: {
    service: 'pos', path: 'transaksi/transaksi_sapa/get_all_tx_sapa',
    required: ['storeId'],
  },
  filter_sapa: {
    service: 'pos', path: 'transaksi/transaksi_sapa/get_all_tx_sapa_filter',
    required: ['storeId'], optional: ['plu', 'qty', 'status', 'type'],
  },
  daftar_ssp: {
    service: 'pos', path: 'transaksi/transaksi_ssp/get_lov_tx_ssp',
    required: ['storeId'],
  },
  data_ssp: {
    service: 'pos', path: 'transaksi/transaksi_ssp/get_all_data_tx_ssp',
    required: ['storeId'], optional: ['splNo'],
  },
  laporan_sales_virtual: {
    service: 'pos', path: 'transaksi/laporan_sales/get_data_laporan_sales_item_virtual',
    required: ['storeId'], optional: ['dateTx', 'userId'],
  },
} satisfies Record<string, EndpointSpec>;

type EndpointName = keyof typeof ENDPOINTS;

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private', ...headers },
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const name = requestUrl.searchParams.get('endpoint');

  // The catalog always opens in the browser, even when no upstream is reachable.
  if (!name) {
    return json({
      success: true,
      message: 'Route Next.js aktif. Daftar endpoint GET berikut berasal dari analisis statis APK, belum terverifikasi aktif.',
      method: 'GET',
      usage: '/api/pos?endpoint=status_toko&storeId=M604',
      requiresAuthentication: false,
      note: 'GET route publik tanpa username/password; respons upstream mungkin tetap memerlukan autentikasi atau akses jaringan.',
      vercelBase: 'https://majormaju9-prosentase-so-api.vercel.app/api/',
      endpoints: Object.entries(ENDPOINTS).map(([key, value]) => ({
        name: key,
        link: `https://majormaju9-prosentase-so-api.vercel.app/api/?endpoint=${encodeURIComponent(key)}&storeId=M604`,
        method: 'GET',
        service: value.service,
        path: value.path,
        required: value.required,
        optional: value.optional || [],
      })),
    });
  }

  if (!Object.prototype.hasOwnProperty.call(ENDPOINTS, name)) {
    return json({
      success: false,
      error: 'Nama endpoint tidak ada dalam allowlist.',
      available: Object.keys(ENDPOINTS),
    }, 400);
  }

  const spec: EndpointSpec = ENDPOINTS[name as EndpointName];
  const missing = spec.required.filter((param) => !requestUrl.searchParams.get(param)?.trim());
  if (missing.length) {
    return json({ success: false, error: 'Parameter wajib belum lengkap.', missing }, 400);
  }

  // Optional guardrail for public deployment; e.g. POS_ALLOWED_STORE_IDS=M604,M2J8.
  const allowedStores = (process.env.POS_ALLOWED_STORE_IDS || '')
    .split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
  const requestedStore = requestUrl.searchParams.get('storeId')?.trim().toUpperCase();
  if (allowedStores.length && (!requestedStore || !allowedStores.includes(requestedStore))) {
    return json({ success: false, error: 'storeId tidak diizinkan pada gateway ini.' }, 403);
  }

  for (const key of [...spec.required, ...(spec.optional || [])]) {
    const value = requestUrl.searchParams.get(key);
    if (value !== null && (value.length > 150 || /[\r\n\x00-\x1f]/.test(value))) {
      return json({ success: false, error: `Parameter ${key} tidak valid.` }, 400);
    }
  }

  const upstream = new URL(spec.path, BASE_URLS[spec.service]);
  const forwarded = [...spec.required, ...(spec.optional || [])];
  for (const key of forwarded) {
    const value = requestUrl.searchParams.get(key);
    if (value !== null) upstream.searchParams.set(key, value);
  }

  // Public gateway: do not forward gateway authorization or saved upstream secrets.
  // If the POS service requires auth, its 401/403 remains enforced.
  const upstreamHeaders: Record<string, string> = { Accept: 'application/json' };

  try {
    const response = await fetch(upstream, {
      method: 'GET',
      headers: upstreamHeaders,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });

    const contentType = response.headers.get('content-type') || '';
    let body: unknown = null;
    if (contentType.includes('json')) {
      body = await response.json().catch(() => null);
    } else {
      // Never mirror potentially sensitive server HTML/error pages to visitors.
      body = null;
    }

    if (!response.ok) {
      return json({
        success: false,
        error: 'Server POS asli mengembalikan kesalahan. Route Vercel tersedia, tetapi akses upstream belum berhasil.',
        endpoint: name,
        upstreamStatus: response.status,
        upstreamContentType: contentType || null,
        possibleCauses: ['URL/path berbeda', 'autentikasi/header server diperlukan', 'IP jaringan tidak diizinkan', 'parameter tidak cocok'],
      }, 502);
    }

    if (!contentType.includes('json') || body === null) {
      return json({
        success: false,
        error: 'Server merespons, tetapi bukan JSON valid. Periksa apakah dialihkan ke halaman login.',
        endpoint: name,
        upstreamStatus: response.status,
        upstreamContentType: contentType || null,
      }, 502);
    }

    return json({ success: true, endpoint: name, upstreamStatus: response.status, data: body });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? 'Koneksi ke server POS melewati batas 12 detik.'
      : 'Tidak dapat menghubungi server POS. Periksa DNS, jaringan, atau akses privat.';
    return json({ success: false, endpoint: name, error: reason }, 502);
  }
}
