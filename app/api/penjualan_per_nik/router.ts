/**
 * Next.js App Router API - simpan sebagai app/api/penjualan_per_nik/route.ts
 * Vercel URL: https://majormaju9-prosentase-so-api.vercel.app/api/penjualan_per_nik
 * Alur diambil dari APK THOR v15.1.1 (PenjualanNikActivity & laporan per kasir).
 * PENTING: APi key dari screenshot di bawah hanya sebagai fallback agar langsung dites.
 * Lebih aman: set ALFA_API_KEY sebagai Environment Variable pribadi di Vercel,
 * hapus nilai fallback sebelum repo dibagikan / dijadikan public.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_ROOT = 'https://app.alfastore.co.id/prd/api/';
const API_KEY = process.env.ALFA_API_KEY || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const HEADER_USER_ID = process.env.ALFA_USER_ID || '20020884';
const DEFAULT_BRANCH_ID = process.env.ALFA_BRANCH_ID || 'MZ01';
const MAX_BON_PER_PAGE = 60;
const CONCURRENCY = 6;
const UPSTREAM_TIMEOUT_MS = 12000;

type JSONObject = Record<string, unknown>;
type SaleItem = { plu: string; barcode: string; namaBarang: string; qty: number; jumlahBon: number };
type UpstreamResult = { status: number; raw: string; parsed: unknown; endpoint: string; ok: boolean };

const obj = (value: unknown): JSONObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JSONObject : null;

function getAny(o: JSONObject | null, keys: string[]): unknown {
  if (!o) return undefined;
  for (const key of keys) {
    if (o[key] !== undefined && o[key] !== null) return o[key];
  }
  return undefined;
}
function textValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
function numberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const valueString = String(value ?? '').replace(/,/g, '.');
  const valueNum = Number(valueString);
  return Number.isFinite(valueNum) ? valueNum : 0;
}
function dateWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function ddmmyyyy(ymd: string): string {
  const [year, month, day] = ymd.split('-');
  return `${day}-${month}-${year}`;
}
function parseApiBody(raw: string): unknown {
  // Beberapa respons internal THOR berbentuk 200^{json}, 204^[], atau 0^pesan.
  const clean = raw.replace(/^\uFEFF/, '').trim();
  const match = clean.match(/^(\d{1,3})\^([\s\S]*)$/);
  const body = match ? match[2].trim() : clean;
  if (!body) return { message: match ? `Status API ${match[1]}` : 'Respons kosong' };
  try { return JSON.parse(body); } catch { return { message: body }; }
}
function payloadRows(value: unknown): JSONObject[] {
  if (Array.isArray(value)) return value.map(obj).filter((x): x is JSONObject => !!x);
  const o = obj(value);
  if (!o) return [];
  for (const key of ['data', 'items', 'rows', 'result', 'dataList', 'transactions', 'datum']) {
    const nested = o[key];
    if (Array.isArray(nested)) return nested.map(obj).filter((x): x is JSONObject => !!x);
    const inner = obj(nested);
    if (inner) {
      for (const k of ['items', 'data', 'rows', 'result']) {
        if (Array.isArray(inner[k])) return (inner[k] as unknown[]).map(obj).filter((x): x is JSONObject => !!x);
      }
    }
  }
  return [];
}
function upstreamMessage(value: unknown): string {
  const o = obj(value);
  const s = getAny(o, ['message', 'msg', 'error', 'description']);
  return textValue(s).slice(0, 550);
}
function requestHeaders(storeId: string, branchId: string): HeadersInit {
  // Header mengikuti screenshot, termasuk Host, Connection, dan Accept-Encoding.
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': API_KEY,
    'App-Name': 'InventoryIntelligence',
    'Platform': 'ANDROID',
    'Store-Id': storeId,
    'User-Id': HEADER_USER_ID,
    'Branch-Id': branchId,
    'Host': 'app.alfastore.co.id',
    'Connection': 'Keep-Alive',
    'Accept-Encoding': 'gzip',
  };
}
async function upstream(path: string, storeId: string, branchId: string, postBody?: JSONObject): Promise<UpstreamResult> {
  const url = new URL(path, API_ROOT);
  const resp = await fetch(url, {
    method: postBody ? 'POST' : 'GET',
    headers: requestHeaders(storeId, branchId),
    body: postBody ? JSON.stringify(postBody) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const raw = await resp.text();
  const parsed = parseApiBody(raw);
  const prefix = raw.trim().match(/^(\d{1,3})\^/);
  const legacyError = prefix && prefix[1] !== '200' && prefix[1] !== '204';
  return {
    status: resp.status,
    raw: raw.slice(0, 200000),
    parsed,
    endpoint: url.pathname,
    ok: resp.ok && !legacyError,
  };
}
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store, private, max-age=0', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Pekerjaan per-bon dibatasi concurrency supaya layanan tidak dibanjiri permintaan. */
async function mapPool<T, U>(list: T[], limit: number, fn: (item: T) => Promise<U>): Promise<U[]> {
  const output: U[] = Array(list.length);
  let idx = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (idx < list.length) {
      const at = idx++;
      output[at] = await fn(list[at]);
    }
  }));
  return output;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const storeId = (params.get('storeId') || 'M865').trim().toUpperCase();
  const nik = (params.get('nik') || params.get('userId') || '').trim();
  const dateTx = (params.get('dateTx') || dateWIB()).trim();
  const branchId = (params.get('branchId') || DEFAULT_BRANCH_ID).trim().toUpperCase();
  const mode = params.get('mode') === 'report' ? 'report' : 'detail';
  const page = Math.min(10000, Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1));
  const limit = Math.min(MAX_BON_PER_PAGE, Math.max(1, Number.parseInt(params.get('limit') || '50', 10) || 50));
  const periode1 = (params.get('periode1') || ddmmyyyy(dateTx)).trim();
  const periode2 = (params.get('periode2') || '').trim();
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) return json({ ok: false, message: 'storeId wajib 4-8 huruf/angka.' }, 400);
  if (!/^\d{1,12}$/.test(nik)) return json({ ok: false, message: 'NIK wajib angka (1-12 digit).' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTx) || !Number.isFinite(Date.parse(`${dateTx}T12:00:00Z`))) {
    return json({ ok: false, message: 'dateTx harus yyyy-MM-dd.' }, 400);
  }
  if (!/^[A-Z0-9_-]{2,12}$/.test(branchId)) return json({ ok: false, message: 'branchId tidak valid.' }, 400);
  if (mode === 'report' && (!/^\d{2}-\d{2}-\d{4}$/.test(periode1) || (periode2 && !/^\d{2}-\d{2}-\d{4}$/.test(periode2)))) {
    return json({ ok: false, message: 'periode1/2 harus dd-MM-yyyy.' }, 400);
  }
  if (!API_KEY) return json({ ok: false, message: 'API key server belum dikonfigurasi.' }, 500);

  try {
    if (mode === 'report') {
      // Di APK: StoreReportReportActivity, rpt/laporan/penjualan_per_kasir
      const search = new URLSearchParams({ storeId, userId: nik, periode1 });
      if (periode2) search.set('periode2', periode2);
      const path = `rpt/laporan/penjualan_per_kasir?${search}`;
      const res = await upstream(path, storeId, branchId);
      if (!res.ok) return json({ ok: false, mode, source: 'alfastore', upstreamStatus: res.status,
        endpoint: `${API_ROOT}rpt/laporan/penjualan_per_kasir`, message: upstreamMessage(res.parsed) || 'Laporan gagal dibuka', raw: res.raw }, 502);
      return json({ ok: true, mode, nik, storeId, dateTx, periode1, periode2: periode2 || null,
        endpoint: `${API_ROOT}rpt/laporan/penjualan_per_kasir`, format: res.raw.trim().startsWith('<') ? 'html' : 'json-or-text',
        result: res.parsed, raw: res.raw });
    }

    // Langkah 1 APK: so/login/cek_login untuk membaca dataUser.bill_no & nama kasir.
    const checkParams = new URLSearchParams({
      storeId, nik, clientDate: `${dateTx} 23:59:59`, version_app: 'V.2021.1.1',
    });
    const checkPath = `so/login/cek_login?${checkParams}`;
    const login = await upstream(checkPath, storeId, branchId);
    if (!login.ok) return json({ ok: false, mode, step: 'cek_login', upstreamStatus: login.status,
      message: upstreamMessage(login.parsed) || 'Pengecekan NIK ditolak Alfastore.',
      endpoint: `${API_ROOT}so/login/cek_login`, raw: login.raw }, 502);
    const top = obj(login.parsed);
    const user = obj(getAny(top, ['dataUser', 'data_user'])) || obj(getAny(obj(top?.data), ['dataUser', 'data_user'])) || obj(top?.data);
    if (!user) return json({ ok: false, mode, step: 'cek_login',
      message: 'Respons cek_login tidak memuat dataUser. Periksa NIK, toko, tanggal, atau hak akses.',
      endpoint: `${API_ROOT}so/login/cek_login`, raw: login.raw }, 502);

    const nama = textValue(getAny(user, ['name', 'nick_name', 'nama', 'namaKasir']));
    const billNo = Math.max(0, Math.min(100000, Math.trunc(numberValue(getAny(user, ['bill_no', 'billNo'])))));
    const start = (page - 1) * limit + 1;
    const end = Math.min(start + limit - 1, billNo);
    const bonNumbers = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

    // Langkah 2 APK: pos/transaksi/retur/get_transaction, POST JSON per nomor bon.
    const errors: Array<{ billNo: number; status: number; message: string }> = [];
    const rowsPerBon = await mapPool(bonNumbers, CONCURRENCY, async (bonNo) => {
      try {
        const res = await upstream('pos/transaksi/retur/get_transaction', storeId, branchId,
          { storeId, dateTx, userId: nik, billNo: bonNo });
        if (!res.ok) {
          errors.push({ billNo: bonNo, status: res.status, message: upstreamMessage(res.parsed) || 'Permintaan detail gagal' });
          return [] as JSONObject[];
        }
        return payloadRows(res.parsed);
      } catch (e) {
        errors.push({ billNo: bonNo, status: 0, message: e instanceof Error ? e.message : 'Network error' });
        return [] as JSONObject[];
      }
    });

    const combined = new Map<string, SaleItem & { bons: Set<number> }>();
    rowsPerBon.forEach((rows, ix) => {
      const bonNo = bonNumbers[ix];
      for (const r of rows) {
        const plu = textValue(getAny(r, ['plu', 'PLU', 'kode_plu', 'itemCode']));
        if (!plu) continue;
        const barcode = textValue(getAny(r, ['barcode', 'Barcode', 'ean']));
        const desc = textValue(getAny(r, ['desc', 'descp', 'description', 'nama_barang', 'namaBarang']));
        const qty = numberValue(getAny(r, ['qty', 'QTY', 'quantity', 'qty_jual', 'qtyJual']));
        const existing = combined.get(plu);
        if (existing) {
          existing.qty += qty;
          if (!existing.barcode && barcode) existing.barcode = barcode;
          if (!existing.namaBarang && desc) existing.namaBarang = desc;
          existing.bons.add(bonNo);
        } else {
          combined.set(plu, { plu, barcode, namaBarang: desc, qty, jumlahBon: 0, bons: new Set([bonNo]) });
        }
      }
    });

    // Langkah 3 APK: sis/master/inventory/lov_items untuk nama/barcode yang belum tersedia.
    const needInfo = [...combined.values()].filter(x => !x.namaBarang || !x.barcode).slice(0, 25);
    await mapPool(needInfo, 4, async (item) => {
      const searchValue = item.barcode || item.plu;
      try {
        const q = new URLSearchParams({ storeId, searchValue });
        const res = await upstream(`sis/master/inventory/lov_items?${q}`, storeId, branchId);
        const choices = payloadRows(res.parsed);
        const found = choices.find(x => textValue(getAny(x, ['plu', 'PLU'])) === item.plu) || choices[0];
        if (found) {
          item.namaBarang ||= textValue(getAny(found, ['descp', 'desc', 'description', 'nama_barang']));
          item.barcode ||= textValue(getAny(found, ['barcode', 'ean']));
        }
      } catch { /* Optional enrichment; QTY tetap bisa ditampilkan. */ }
      return null;
    });

    const items = [...combined.values()].map(({ bons, ...rest }) => ({ ...rest, jumlahBon: bons.size }))
      .sort((a, b) => a.plu.localeCompare(b.plu, 'id', { numeric: true }));
    return json({
      ok: true, mode, storeId, nik, namaKasir: nama, dateTx, branchId,
      totalBonDariLogin: billNo, bonDiminta: bonNumbers.length, bonBerhasil: bonNumbers.length - errors.length,
      totalPLU: items.length, totalQty: items.reduce((acc, row) => acc + row.qty, 0),
      items, page, limit, hasMore: end < billNo, errors: errors.slice(0, 25),
      partial: errors.length > 0 || end < billNo,
      endpoints: [
        `${API_ROOT}so/login/cek_login`,
        `${API_ROOT}pos/transaksi/retur/get_transaction`,
        `${API_ROOT}sis/master/inventory/lov_items`,
      ],
      note: 'Jumlah QTY hanya dari bon yang berhasil diambil pada halaman ini. Tidak menyatakan 0 penjualan jika ada bon gagal.',
    });
  } catch (error) {
    return json({ ok: false, message: 'Gagal menghubungi layanan Alfastore. Cek header, jaringan, hak akses dan URL upstream.',
      detail: error instanceof Error ? error.message : 'Unknown server error' }, 502);
  }
}
