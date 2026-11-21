/**
 * PASPRO / Penjualan per NIK — API proxy untuk Next.js App Router (Vercel).
 * Install: app/api/sql/route.ts  -> POST /api/sql
 *
 * Header autentikasi hanya dikirim dari server. Jangan unggah file sumber ini
 * ke repositori publik jika memakai API key fallback di bawah.
 *
 * Pemanggilan mengikuti endpoint THOR v15.1.1:
 *  (opsional) GET  so/login/cek_login  -> mengetahui bill_no tertinggi
 *             POST pos/transaksi/retur/get_transaction -> detail penjualan
 *             GET  sis/master/inventory/lov_items     -> nama/barcode barang
 *
 * 404 dari cek_login TIDAK menggagalkan pencarian: pemindaian per halaman
 * otomatis tetap dapat berjalan. 404 dari get_transaction yang menunjukkan
 * route hilang tetap dilaporkan secara jujur, bukan dianggap barang kosong.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE = (process.env.SIS_API_BASE || 'https://app.alfastore.co.id/prd/api/').replace(/\/*$/, '/');
const API_KEY = process.env.SIS_API_KEY || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const HEADER_USER_ID = process.env.SIS_HEADER_USER_ID || '20020884';
const BRANCH_ID = process.env.SIS_BRANCH_ID || 'MZ01';
const APP_NAME = process.env.SIS_APP_NAME || 'InventoryIntelligence';
const PAGE_SIZE = 30;
const CONCURRENCY = 10;
const MAX_AUTOSCAN_BON = 20000; // pengaman beban server, bukan kontrol pengguna

export type Dict = Record<string, unknown>;
type Item = { plu: string; nama: string; barcode: string; qty: number };
type ApiReply = { ok: boolean; status: number; data: unknown; isJson: boolean; message: string };
type UserInput = { storeId: string; nik: string; tanggal: string };

const OUT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};
function respond(body: Dict, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: OUT_HEADERS });
}
function object(v: unknown): Dict | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Dict : null;
}
function str(v: unknown) {
  return v === undefined || v === null ? '' : String(v).trim();
}
function field(row: Dict, names: string[]): string {
  for (const key of names) {
    const v = str(row[key]);
    if (v && v !== 'null' && v !== 'undefined') return v;
  }
  return '';
}
function num(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(str(v).replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}
function upstreamHeaders(storeId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': API_KEY,
    'App-Name': APP_NAME,
    'Platform': 'ANDROID',
    'Store-Id': storeId,
    'User-Id': HEADER_USER_ID,
    'Branch-Id': BRANCH_ID,
    'Connection': 'Keep-Alive',
    'Accept-Encoding': 'gzip',
  };
}
function upstreamUrl(path: string): URL {
  // path relatif, tidak pernah menerima URL penuh dari pengguna.
  return new URL(path.replace(/^\/+/, ''), BASE);
}
async function api(path: string, storeId: string, method: 'GET' | 'POST', body?: Dict): Promise<ApiReply> {
  try {
    const res = await fetch(upstreamUrl(path), {
      method,
      headers: upstreamHeaders(storeId),
      ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(7500),
    });
    if (res.status === 204) return { ok: true, status: 204, data: [], isJson: true, message: '' };
    const raw = await res.text();
    const clean = /^\d{3}\^/.test(raw) ? raw.slice(4) : raw;
    let data: unknown = null;
    let isJson = false;
    if (clean.trim()) {
      try { data = JSON.parse(clean); isJson = true; } catch { /* HTML / WAF / not found */ }
    }
    const root = object(data);
    const serverMessage = root ? field(root, ['message', 'msg', 'error', 'description']) : '';
    return {
      ok: res.ok && isJson,
      status: res.status,
      data,
      isJson,
      message: !res.ok ? `HTTP ${res.status}${serverMessage ? `: ${serverMessage.slice(0, 120)}` : ''}`
        : !isJson ? 'Server mengembalikan HTML/teks, bukan JSON'
          : serverMessage,
    };
  } catch (err) {
    const message = err instanceof Error && /Timeout|Abort/.test(err.name) ? 'Timeout API upstream' : 'Koneksi API upstream gagal';
    return { ok: false, status: 0, data: null, isJson: false, message };
  }
}
function inputs(post: Dict): UserInput | string {
  const storeId = str(post.storeId).toUpperCase();
  const nik = str(post.nik);
  const tanggal = str(post.tanggal);
  if (!/^[A-Z0-9]{4,6}$/.test(storeId)) return 'Kode toko harus 4–6 huruf/angka.';
  if (!/^\d{4,12}$/.test(nik)) return 'NIK harus berisi 4–12 angka.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return 'Tanggal tidak valid. Gunakan YYYY-MM-DD.';
  const [y, m, d] = tanggal.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return 'Tanggal tidak valid.';
  return { storeId, nik, tanggal };
}
function nowJakarta(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}:${map.second}` };
}
function loginUser(data: unknown): Dict | null {
  const root = object(data);
  if (!root) return null;
  const sub = object(root.data);
  const choices = [root.dataUser, sub?.dataUser, root.user, sub?.user, root.data, root.result, root];
  for (const value of choices) {
    const v = Array.isArray(value) ? value[0] : value;
    const u = object(v);
    if (u && ('bill_no' in u || 'name' in u || 'nick_name' in u)) return u;
  }
  return null;
}
function findRows(data: unknown, level = 0): Dict[] {
  if (level > 9 || data == null) return [];
  if (Array.isArray(data)) return data.flatMap(x => findRows(x, level + 1));
  const root = object(data);
  if (!root) return [];
  const plu = field(root, ['plu', 'PLU', 'prdcd', 'kode_barang', 'item_code']);
  if (plu && (root.qty !== undefined || root.quantity !== undefined || root.jumlah !== undefined || root.s_qty !== undefined)) return [root];
  return ['data', 'items', 'item', 'detail', 'details', 'list', 'rows', 'result', 'transactions', 'dataItem', 'dataDetail', 'data_table']
    .flatMap(k => findRows(root[k], level + 1));
}
function itemFromRow(row: Dict): Item | null {
  const plu = field(row, ['plu', 'PLU', 'prdcd', 'kode_barang', 'item_code']);
  const qty = num(row.qty ?? row.quantity ?? row.jumlah ?? row.s_qty);
  if (!plu || !qty) return null;
  return {
    plu,
    nama: field(row, ['desc', 'descp', 'description', 'namaBarang', 'nama_barang', 'name', 'nama']) || `Item ${plu}`,
    barcode: field(row, ['barcode', 'barCode', 'ean']),
    qty,
  };
}
function addItem(map: Map<string, Item>, item: Item) {
  const curr = map.get(item.plu);
  if (!curr) { map.set(item.plu, item); return; }
  curr.qty += item.qty;
  if ((!curr.nama || /^Item\s/i.test(curr.nama)) && item.nama && !/^Item\s/i.test(item.nama)) curr.nama = item.nama;
  if (!curr.barcode && item.barcode) curr.barcode = item.barcode;
}
function lovRows(data: unknown, level = 0): Dict[] {
  if (level > 7 || data == null) return [];
  if (Array.isArray(data)) return data.flatMap(x => lovRows(x, level + 1));
  const o = object(data);
  if (!o) return [];
  if (field(o, ['plu', 'PLU', 'prdcd'])) return [o];
  return ['data', 'items', 'item', 'result', 'list', 'rows'].flatMap(k => lovRows(o[k], level + 1));
}
async function init(data: UserInput): Promise<Response> {
  const now = nowJakarta();
  const clientDate = data.tanggal === now.date ? `${now.date} ${now.time}` : `${data.tanggal} 23:59:59`;
  const query = new URLSearchParams({ storeId: data.storeId, nik: data.nik, clientDate, version_app: 'V.2021.1.1' });
  const login = await api(`so/login/cek_login?${query}`, data.storeId, 'GET');
  const user = login.ok ? loginUser(login.data) : null;
  let maxBill: number | null = null;
  if (user && 'bill_no' in user) {
    const n = num(user.bill_no);
    if (n >= 0 && Number.isInteger(n)) maxBill = n;
  }
  const namaKasir = user ? field(user, ['name', 'nick_name', 'nama']) : '';
  const warnings: string[] = [];
  if (!login.ok) {
    if (login.status === 404) warnings.push('Endpoint cek_login merespons HTTP 404. Pencarian detail tetap dilanjutkan otomatis tanpa bergantung pada endpoint tersebut.');
    else warnings.push(`Pemeriksaan identitas NIK tidak tersedia (${login.message}). Detail penjualan tetap dicoba.`);
  } else if (maxBill === null) {
    warnings.push('Server tidak mengirim bill_no. Batas akhir bon tidak diketahui; pencarian menggunakan deteksi jeda transaksi dan hasilnya mungkin belum lengkap.');
  }
  return respond({ success: true, action: 'init',
    namaKasir: namaKasir || `NIK ${data.nik}`, maxBill, pageSize: PAGE_SIZE,
    maxAutoScan: MAX_AUTOSCAN_BON, warnings,
    metode: maxBill === null ? 'otomatis-heuristik' : 'otomatis-sampai-bill_no',
  });
}
async function scan(data: UserInput, req: Dict): Promise<Response> {
  const from = Number(req.fromBon);
  const count = Number(req.count || PAGE_SIZE);
  if (!Number.isSafeInteger(from) || from < 1 || from > MAX_AUTOSCAN_BON) return respond({ success: false, message: `Posisi pemindaian di luar batas server (1–${MAX_AUTOSCAN_BON}).` }, 400);
  if (!Number.isSafeInteger(count) || count < 1 || count > PAGE_SIZE || from + count - 1 > MAX_AUTOSCAN_BON) return respond({ success: false, message: 'Ukuran halaman pemindaian tidak valid.' }, 400);
  const found = new Map<string, Item>();
  const marker: Array<boolean | null> = Array(count).fill(null);
  const statuses: Record<string, number> = {};
  let next = 0, successfulResponses = 0, foundBills = 0, failed = 0;
  const errors: string[] = [];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, count) }, async () => {
    while (next < count) {
      const index = next++;
      const billNo = from + index;
      const r = await api('pos/transaksi/retur/get_transaction', data.storeId, 'POST', {
        storeId: data.storeId, dateTx: data.tanggal, userId: data.nik, billNo,
      });
      if (!r.ok) {
        failed++;
        const code = String(r.status || 'koneksi');
        statuses[code] = (statuses[code] || 0) + 1;
        if (errors.length < 3) errors.push(`Bon ${billNo}: ${r.message}`);
        continue;
      }
      successfulResponses++;
      const rows = findRows(r.data);
      let hasData = false;
      for (const row of rows) {
        const item = itemFromRow(row);
        if (!item) continue;
        hasData = true;
        addItem(found, item);
      }
      if (hasData) foundBills++;
      marker[index] = hasData;
    }
  }));
  if (successfulResponses === 0) {
    const all404 = statuses['404'] === count;
    const unauthorized = Boolean(statuses['401'] || statuses['403']);
    const message = all404
      ? 'API detail transaksi mengembalikan HTTP 404 untuk seluruh nomor bon. Endpoint pos/transaksi/retur/get_transaction mungkin tidak tersedia pada server upstream. Ini bukan kesalahan jumlah bon atau login. Periksa base URL dan route server Alfastore.'
      : unauthorized
        ? 'API detail transaksi menolak akses (HTTP 401/403). Periksa Api-Key, Store-Id, User-Id, Branch-Id, dan hak akses akun resmi.'
        : 'Semua permintaan detail transaksi gagal. Periksa jaringan dan ketersediaan endpoint upstream.';
    return respond({ success: false, tahap: 'get_transaction', message, statuses, errors }, 502);
  }
  const items = [...found.values()].sort((a, b) => a.plu.localeCompare(b.plu, 'id', { numeric: true }));
  return respond({ success: true, action: 'scan', fromBon: from, akhirBon: from + count - 1,
    scanned: count, successfulResponses, foundBills, failed, statuses, errors, marker, items });
}
async function enrich(data: UserInput, req: Dict): Promise<Response> {
  const raw = req.plus;
  if (!Array.isArray(raw) || raw.length > 20 || raw.length < 1) return respond({ success: false, message: 'Daftar PLU tidak valid (maks. 20).' }, 400);
  const plus = raw.map(str);
  if (plus.some(p => !/^[A-Za-z0-9._-]{1,32}$/.test(p))) return respond({ success: false, message: 'Format PLU tidak valid.' }, 400);
  const found: Record<string, { nama: string; barcode: string }> = {};
  let cursor = 0, failures = 0;
  await Promise.all(Array.from({ length: Math.min(5, plus.length) }, async () => {
    while (cursor < plus.length) {
      const plu = plus[cursor++];
      const query = new URLSearchParams({ storeId: data.storeId, searchValue: plu });
      const r = await api(`sis/master/inventory/lov_items?${query}`, data.storeId, 'GET');
      if (!r.ok) { failures++; continue; }
      const matching = lovRows(r.data).find(v => field(v, ['plu', 'PLU', 'prdcd']) === plu);
      if (!matching) continue;
      found[plu] = { nama: field(matching, ['descp', 'desc', 'description', 'namaBarang', 'nama_barang', 'name']),
        barcode: field(matching, ['barcode', 'barCode']) };
    }
  }));
  return respond({ success: true, action: 'enrich', found, failures });
}

export async function GET(): Promise<Response> {
  return respond({ success: true, message: 'Endpoint /api/sql aktif. Untuk mencari penjualan gunakan POST dari index.php.', metode: 'scan bertahap' });
}
export async function POST(req: Request): Promise<Response> {
  let post: Dict | null = null;
  try { post = object(await req.json()); } catch { /* invalid */ }
  if (!post) return respond({ success: false, message: 'Body JSON tidak valid.' }, 400);
  const parsed = inputs(post);
  if (typeof parsed === 'string') return respond({ success: false, message: parsed }, 400);
  switch (str(post.action)) {
    case 'init': return init(parsed);
    case 'scan': return scan(parsed, post);
    case 'enrich': return enrich(parsed, post);
    default: return respond({ success: false, message: 'Action harus init, scan, atau enrich.' }, 400);
  }
}
