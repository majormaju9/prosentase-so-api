/**
 * Endpoint penjualan per NIK THOR v15.1.1 — langsung tanpa proses login.
 * Letakkan hanya di: app/api/penjualan_per_nik/route.ts
 * Tidak mengubah /api/sql (berpotensi digunakan fitur Clerek/SQL lain).
 *
 * mode=report (default): GET rpt/laporan/penjualan_per_kasir
 * mode=transaction&billNo=1: POST pos/transaksi/retur/get_transaction
 * Kedua mode langsung memanggil endpoint laporan/transaksi Alfastore.
 *
 * Header kunci tetap server-side melalui ALFA_API_KEY. Jangan commit kunci!
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE = 'https://app.alfastore.co.id/prd/api/';
const VERSION = '2026-11-18-direct-no-login';
const API_KEY = process.env.ALFA_API_KEY || '';
const DEFAULT_BRANCH_ID = process.env.ALFA_BRANCH_ID || 'MZ01';
const TIMEOUT_MS = 18000;

type R = Record<string, unknown>;
type Upstream = { status: number; ok: boolean; text: string; data: unknown; format: string; path: string; contentType: string };
type SaleRow = { plu: string; barcode: string; namaBarang: string; qty: number; jumlahBaris: number };
const asObject = (v: unknown): R | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as R : null;
const asText = (v: unknown): string => v == null ? '' : String(v).trim();
const value = (obj: R | null, keys: string[]): unknown => {
  if (!obj) return undefined;
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
};
const quantity = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = asText(v).replace(/\s/g, '').replace(/,/g, '.');
  if (!s || !/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const num = Number(s); return Number.isFinite(num) ? num : null;
};
const isoToDmy = (d: string): string => { const [y,m,day] = d.split('-'); return `${day}-${m}-${y}`; };
const todayWib = (): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store, private, max-age=0', 'X-Content-Type-Options': 'nosniff' },
});

// Dukungan format lama THOR: 200^{...}, 204^[], atau JSON biasa.
function decode(raw: string): { data: unknown; format: string; legacyStatus?: string } {
  const clean = raw.replace(/^\uFEFF/, '').trim();
  const legacy = clean.match(/^(\d{1,3})\^([\s\S]*)$/);
  const text = legacy ? legacy[2].trim() : clean;
  if (!text) return { data: null, format: 'empty', legacyStatus: legacy?.[1] };
  try { return { data: JSON.parse(text) as unknown, format: 'json', legacyStatus: legacy?.[1] }; }
  catch { return { data: text, format: /^</.test(text) ? 'html' : 'text', legacyStatus: legacy?.[1] }; }
}

// Mengambil hanya baris yang benar-benar memuat PLU dan QTY: jangan mengarang QTY.
function collectRows(data: unknown): R[] {
  const rows: R[] = [];
  const seen = new Set<unknown>();
  function visit(node: unknown, depth: number): void {
    if (depth > 6 || !node || typeof node !== 'object' || seen.has(node) || rows.length > 20000) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const o = asObject(node);
    if (!o) return;
    const plu = value(o, ['plu', 'PLU', 'kdPlu', 'kd_plu', 'itemCode', 'item_code']);
    const qty = value(o, ['qty', 'QTY', 'Qty', 'quantity', 'qtyJual', 'qty_jual', 'total_qty', 'qtySale', 'saleQty']);
    if (plu !== undefined && qty !== undefined) {
      rows.push(o);
      return; // hindari menghitung detail yang sama 2 kali
    }
    for (const [k, child] of Object.entries(o)) {
      if (/^(data|items|rows|result|results|transactions|details|detail|dataList|list|records|content|response|payload)$/i.test(k)) {
        visit(child, depth + 1);
      }
    }
  }
  visit(data, 0);
  return rows;
}
function normalize(data: unknown): SaleRow[] {
  const combined = new Map<string, SaleRow>();
  for (const o of collectRows(data)) {
    const plu = asText(value(o, ['plu','PLU','kdPlu','kd_plu','itemCode','item_code']));
    const qty = quantity(value(o, ['qty','QTY','Qty','quantity','qtyJual','qty_jual','total_qty','qtySale','saleQty']));
    if (!plu || qty === null) continue;
    const barcode = asText(value(o, ['barcode', 'Barcode', 'ean', 'ean13']));
    const namaBarang = asText(value(o, ['descp','desc','description','nama_barang','namaBarang','nama','itemName']));
    const prior = combined.get(plu);
    if (prior) {
      prior.qty += qty;
      prior.jumlahBaris++;
      if (!prior.barcode) prior.barcode = barcode;
      if (!prior.namaBarang) prior.namaBarang = namaBarang;
    } else combined.set(plu, { plu, barcode, namaBarang, qty, jumlahBaris: 1 });
  }
  return [...combined.values()].sort((a,b)=>a.plu.localeCompare(b.plu,'id',{numeric:true}));
}
async function callUpstream(path: string, storeId: string, branchId: string, headerUser: string, body?: R): Promise<Upstream> {
  const url = new URL(path, API_BASE);
  const headers: Record<string,string> = {
    'Accept': 'application/json', 'Content-Type': 'application/json',
    'User-Agent': 'python-requests/2.28.2', 'Api-Key': API_KEY,
    'App-Name': 'InventoryIntelligence', 'Platform': 'ANDROID',
    'Store-Id': storeId, 'User-Id': headerUser, 'Branch-Id': branchId,
  };
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual',
  });
  const text = (await response.text()).slice(0, 300000);
  const parsed = decode(text);
  const ok = response.ok && (!parsed.legacyStatus || ['200','201','204'].includes(parsed.legacyStatus));
  return { status: response.status, ok, text, data: parsed.data, format: parsed.format,
    path: url.pathname, contentType: response.headers.get('content-type') || '' };
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const nik = (p.get('nik') || p.get('userId') || '').trim();
  const storeId = (p.get('storeId') || '').trim().toUpperCase();
  const dateTx = (p.get('dateTx') || todayWib()).trim();
  const branchId = (p.get('branchId') || DEFAULT_BRANCH_ID).trim().toUpperCase();
  const mode = p.get('mode') === 'transaction' ? 'transaction' : 'report';
  const billNoText = (p.get('billNo') || '').trim();

  if (!nik || p.get('mode') === 'health') return json({
    ok: true, status: 'route-ready', version: VERSION, path: '/api/penjualan_per_nik',
    message: 'Route aktif. Masukkan storeId, nik, dan dateTx untuk langsung memuat laporan penjualan tanpa proses login.',
    apiKeyConfigured: Boolean(API_KEY), loginRequired: false,
    modes: ['report','transaction'],
    example: '/api/penjualan_per_nik?storeId=M865&nik=20020884&dateTx=2026-11-18&branchId=MZ01&mode=report',
    exampleTransaction: '/api/penjualan_per_nik?storeId=M865&nik=20020884&dateTx=2026-11-18&branchId=MZ01&mode=transaction&billNo=1',
  });
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) return json({ok:false,message:'storeId wajib 4-8 karakter alfanumerik.'},400);
  if (!/^\d{1,12}$/.test(nik)) return json({ok:false,message:'nik wajib 1-12 digit angka.'},400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTx) || Number.isNaN(Date.parse(`${dateTx}T12:00:00Z`)))
    return json({ok:false,message:'dateTx wajib yyyy-MM-dd.'},400);
  if (!/^[A-Z0-9_-]{2,12}$/.test(branchId)) return json({ok:false,message:'branchId tidak valid.'},400);
  if (!API_KEY) return json({ok:false,message:'ALFA_API_KEY belum disetel di Vercel.'},503);

  const headerUser = (process.env.ALFA_USER_ID || nik).trim();
  const periode1 = isoToDmy(dateTx);
  let endpoint: string;
  let body: R | undefined;
  if (mode === 'transaction') {
    const billNo = Number(billNoText);
    if (!/^\d{1,8}$/.test(billNoText) || !Number.isSafeInteger(billNo) || billNo < 1)
      return json({ok:false,mode,message:'Mode transaction memerlukan billNo angka positif yang diketahui dari data resmi.'},400);
    endpoint = 'pos/transaksi/retur/get_transaction';
    body = { storeId, dateTx, userId: nik, billNo };
  } else {
    // Endpoint yang benar-benar ditemukan sebagai string di APK THOR v15.1.1.
    endpoint = `rpt/laporan/penjualan_per_kasir?${new URLSearchParams({storeId,userId:nik,periode1})}`;
  }
  try {
    const up = await callUpstream(endpoint, storeId, branchId, headerUser, body);
    const endpointPath = up.path; // hanya path, tidak membocorkan header
    if (!up.ok) return json({
      ok:false, mode, step: mode==='report'?'penjualan_per_kasir':'get_transaction',
      upstreamStatus:up.status, endpoint:`${API_BASE}${endpointPath.replace(/^\/prd\/api\//,'')}`,
      message:up.format==='html' ? 'Server Alfastore mengembalikan HTML, bukan data API. Endpoint mungkin tidak tersedia untuk akses ini.'
        : asText(value(asObject(up.data),['message','msg','error','description'])) || 'Permintaan ditolak oleh Alfastore.',
      responsePreview:up.text.slice(0,500),
      hint:'404 upstream tidak diselesaikan dengan mengganti nama route Vercel. Konfirmasi endpoint dan izin akses pada sistem resmi Alfastore.',
    }, 502);
    const items = normalize(up.data);
    const qtyAvailable = items.length > 0;
    return json({
      ok:true, status:'upstream-connected', version:VERSION, mode,
      source:'Alfastore', storeId, nik, dateTx, branchId, periode1,
      upstreamStatus:up.status, endpoint:endpointPath,
      format:up.format, qtyAvailable,
      totalPLU:items.length, totalQty:qtyAvailable?items.reduce((sum,x)=>sum+x.qty,0):null,
      items,
      note:qtyAvailable
        ? 'QTY dihitung dari baris item respons Alfastore yang memuat PLU dan QTY.'
        : 'Respons diterima tetapi tidak ditemukan pasangan PLU+QTY. Jangan menganggap QTY = 0.',
      report:up.data,
    });
  } catch (err) {
    return json({ok:false,mode,message:'Koneksi upstream gagal atau timeout.',
      detail:err instanceof Error?err.message:'Unknown error'},502);
  }
}
