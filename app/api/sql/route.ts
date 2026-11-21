/**
 * Penjualan per NIK (THOR v15.1.1-compatible flow)
 * Deploy to Next.js/Vercel: app/api/sql/route.ts
 * Endpoint: https://majormaju9-prosentase-so-api.vercel.app/api/sql
 *
 * Semua header ke API upstream berada di SERVER, tidak dikirim ke index.php.
 * PENTING: Jangan publikasikan source ini karena memuat API key.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const API_BASE = 'https://app.alfastore.co.id/prd/api/';

// Header dari tangkapan layar. Server-side ONLY (tidak di browser).
// Disarankan set SIS_API_KEY di Vercel Environment Variables bila source berada di Git publik.
const PRIVATE_API_KEY = process.env.SIS_API_KEY || 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const HEADER_USER_ID = process.env.SIS_HEADER_USER_ID || '20020884';
const BRANCH_ID = process.env.SIS_BRANCH_ID || 'MZ01';
const APP_NAME = 'InventoryIntelligence';
const MAX_BILLS_PER_CALL = 450;
const MAX_CONCURRENT = 12;

type JsonMap = Record<string, unknown>;
type ApiReply = { ok: boolean; status: number; data: unknown; error: string };
type Item = { plu: string; nama: string; barcode: string; qty: number };
type Inputs = { storeId: string; nik: string; tanggal: string; mulaiBon: number; batasBon: number };

const HTTP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResult(data: JsonMap, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: HTTP_HEADERS });
}

function asObject(value: unknown): JsonMap | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonMap) : null;
}

function asText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function stringField(row: JsonMap, names: string[]): string {
  for (const key of names) {
    const s = asText(row[key]);
    if (s && s !== 'null' && s !== 'undefined') return s;
  }
  return '';
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = asText(value);
  if (!s) return 0;
  const n = Number(s.replace(/,/g, '.'));
  return Number.isFinite(n) ? n : 0;
}

function requestHeaders(storeId: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'python-requests/2.28.2',
    'Api-Key': PRIVATE_API_KEY,
    'App-Name': APP_NAME,
    Platform: 'ANDROID',
    'Store-Id': storeId,
    'User-Id': HEADER_USER_ID,
    'Branch-Id': BRANCH_ID,
    Host: 'app.alfastore.co.id',
    Connection: 'Keep-Alive',
    'Accept-Encoding': 'gzip',
  };
}

async function fetchApi(path: string, storeId: string, method: 'GET' | 'POST', body?: JsonMap): Promise<ApiReply> {
  try {
    const res = await fetch(new URL(path, API_BASE), {
      method,
      headers: requestHeaders(storeId),
      ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });
    const txt = await res.text();
    let data: unknown = null;
    if (txt) {
      // Beberapa wrapper aplikasi THOR menggunakan prefix "200^"; HTTP biasanya JSON murni.
      const cleaned = /^\d{3}\^/.test(txt) ? txt.slice(4) : txt;
      try { data = JSON.parse(cleaned); }
      catch { return { ok: false, status: res.status, data: null, error: `Respons bukan JSON (HTTP ${res.status})` }; }
    }
    return { ok: res.ok, status: res.status, data, error: res.ok ? '' : `HTTP ${res.status}` };
  } catch (e) {
    const error = e instanceof Error && e.name === 'TimeoutError' ? 'Timeout server upstream' : 'Tidak dapat terhubung ke server upstream';
    return { ok: false, status: 0, data: null, error };
  }
}

function jakartaNow(): { tanggal: string; clientDate: string } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(new Date())) if (p.type !== 'literal') parts[p.type] = p.value;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { tanggal: date, clientDate: `${date} ${parts.hour}:${parts.minute}:${parts.second}` };
}

function readInputs(req: Request, posted: JsonMap | null): Inputs | string {
  const url = new URL(req.url);
  const value = (name: string, alt?: string): unknown => posted?.[name] ?? (alt ? posted?.[alt] : null) ?? url.searchParams.get(name) ?? (alt ? url.searchParams.get(alt) : null);
  const storeId = asText(value('storeId', 'kodeToko')).toUpperCase();
  const nik = asText(value('nik', 'userId'));
  const tanggal = asText(value('tanggal', 'dateTx'));
  const mulaiBon = Number(value('mulaiBon') ?? 1);
  const batasBon = Number(value('batasBon') ?? 350);
  if (!/^[A-Z0-9]{4,6}$/.test(storeId)) return 'Kode toko harus 4–6 huruf/angka.';
  if (!/^\d{4,12}$/.test(nik)) return 'NIK harus 4–12 angka.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(Date.parse(`${tanggal}T00:00:00+07:00`))) return 'Tanggal wajib berformat YYYY-MM-DD.';
  if (!Number.isInteger(mulaiBon) || mulaiBon < 1 || mulaiBon > 999999) return 'Nomor bon awal harus angka positif.';
  if (!Number.isInteger(batasBon) || batasBon < 1 || batasBon > MAX_BILLS_PER_CALL) return `Batas bon harus 1–${MAX_BILLS_PER_CALL}.`;
  return { storeId, nik, tanggal, mulaiBon, batasBon };
}

function loginUser(data: unknown): JsonMap | null {
  const root = asObject(data);
  if (!root) return null;
  const sub = asObject(root.data);
  const options: unknown[] = [root.dataUser, sub?.dataUser, sub?.user, root.user, root.data, root.result];
  for (const v of options) {
    if (Array.isArray(v) && v.length) return asObject(v[0]);
    const o = asObject(v);
    if (o && ('bill_no' in o || 'name' in o || 'nick_name' in o)) return o;
  }
  return 'bill_no' in root ? root : null;
}

function extractRows(data: unknown, depth = 0): JsonMap[] {
  if (depth > 7 || data == null) return [];
  if (Array.isArray(data)) return data.flatMap(v => extractRows(v, depth + 1));
  const obj = asObject(data);
  if (!obj) return [];
  const code = stringField(obj, ['plu', 'PLU', 'prdcd', 'kode_barang', 'item_code']);
  if (code && (obj.qty !== undefined || obj.quantity !== undefined || obj.jumlah !== undefined || obj.s_qty !== undefined)) return [obj];
  const keys = ['data', 'items', 'item', 'detail', 'details', 'list', 'rows', 'result', 'transactions', 'dataItem', 'dataDetail', 'data_table'];
  let found: JsonMap[] = [];
  for (const key of keys) if (obj[key] !== undefined) found = found.concat(extractRows(obj[key], depth + 1));
  return found;
}

function getItem(row: JsonMap): Item | null {
  const plu = stringField(row, ['plu', 'PLU', 'prdcd', 'kode_barang', 'item_code']);
  const qty = numberValue(row.qty ?? row.quantity ?? row.jumlah ?? row.s_qty);
  if (!plu || !qty) return null;
  const name = stringField(row, ['desc', 'descp', 'description', 'namaBarang', 'nama_barang', 'name', 'nama']);
  const barcode = stringField(row, ['barcode', 'barCode', 'ean']);
  return { plu, nama: name || `Item ${plu}`, barcode, qty };
}

async function enrichMissing(items: Item[], storeId: string, deadline: number): Promise<number> {
  const missing = items.filter(x => !x.barcode || !x.nama || /^item\s/i.test(x.nama)).slice(0, 65);
  let cursor = 0; let filled = 0;
  const workers = Array.from({ length: Math.min(6, missing.length) }, async () => {
    while (cursor < missing.length && Date.now() < deadline) {
      const row = missing[cursor++];
      const query = new URLSearchParams({ storeId, searchValue: row.plu });
      const res = await fetchApi(`sis/master/inventory/lov_items?${query}`, storeId, 'GET');
      if (!res.ok) continue;
      const candidates = extractLovRows(res.data);
      const matching = candidates.find(v => stringField(v, ['plu', 'PLU', 'prdcd']) === row.plu);
      if (!matching) continue;
      if (!row.barcode) row.barcode = stringField(matching, ['barcode', 'barCode']);
      if (!row.nama || /^item\s/i.test(row.nama)) {
        const better = stringField(matching, ['descp', 'desc', 'description', 'namaBarang', 'nama_barang', 'name']);
        if (better) { row.nama = better; filled++; }
      }
    }
  });
  await Promise.all(workers);
  return filled;
}

function extractLovRows(data: unknown, depth = 0): JsonMap[] {
  if (depth > 5) return [];
  if (Array.isArray(data)) return data.flatMap(v => extractLovRows(v, depth + 1));
  const obj = asObject(data);
  if (!obj) return [];
  if (stringField(obj, ['plu', 'PLU', 'prdcd'])) return [obj];
  return ['data', 'items', 'item', 'result', 'list', 'rows'].flatMap(k => extractLovRows(obj[k], depth + 1));
}

async function run(req: Request, posted: JsonMap | null): Promise<Response> {
  const parsed = readInputs(req, posted);
  if (typeof parsed === 'string') return jsonResult({ success: false, message: parsed }, 400);
  const { storeId, nik, tanggal, mulaiBon, batasBon } = parsed;
  const start = Date.now();
  const deadline = start + 51500;
  const now = jakartaNow();
  const clientDate = tanggal === now.tanggal ? now.clientDate : `${tanggal} 23:59:59`;
  const loginParams = new URLSearchParams({ storeId, nik, clientDate, version_app: 'V.2021.1.1' });
  const login = await fetchApi(`so/login/cek_login?${loginParams}`, storeId, 'GET');
  if (!login.ok) {
    return jsonResult({ success: false, tahap: 'cek_login', message: `Gagal mengambil data NIK: ${login.error}. Periksa Api-Key, header dan hak akses toko.` }, 502);
  }
  const user = loginUser(login.data);
  if (!user) return jsonResult({ success: false, tahap: 'cek_login', message: 'dataUser tidak ditemukan pada respons login. Struktur respons mungkin telah berubah.' }, 502);
  const namaKasir = stringField(user, ['name', 'nick_name', 'nama']) || `KASIR ${nik}`;
  const maxBill = Math.max(0, Math.trunc(numberValue(user.bill_no)));
  const akhirBon = Math.min(maxBill, mulaiBon + batasBon - 1);
  const totalScan = Math.max(0, akhirBon - mulaiBon + 1);
  const warnings: string[] = [];
  if (maxBill > akhirBon) warnings.push(`Masih ada nomor bon sampai ${maxBill}. Untuk melanjutkan, masukkan Mulai Bon = ${akhirBon + 1}.`);
  const found = new Map<string, Item>();
  let cursor = mulaiBon, scanned = 0, billWithItems = 0, failed = 0, fatal = 0;
  if (totalScan > 0) {
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, totalScan) }, async () => {
      while (cursor <= akhirBon && Date.now() < deadline && fatal === 0) {
        const billNo = cursor++;
        const r = await fetchApi('pos/transaksi/retur/get_transaction', storeId, 'POST', {
          storeId, dateTx: tanggal, userId: nik, billNo,
        });
        scanned++;
        if (!r.ok) {
          failed++;
          if ([401, 403, 429].includes(r.status)) fatal = r.status;
          continue;
        }
        const rows = extractRows(r.data);
        if (rows.length) billWithItems++;
        for (const row of rows) {
          const item = getItem(row);
          if (!item) continue;
          const old = found.get(item.plu);
          if (!old) found.set(item.plu, item);
          else {
            old.qty += item.qty;
            if (/^item\s/i.test(old.nama) && !/^item\s/i.test(item.nama)) old.nama = item.nama;
            if (!old.barcode) old.barcode = item.barcode;
          }
        }
      }
    });
    await Promise.all(workers);
  }
  if (fatal) return jsonResult({ success: false, tahap: 'get_transaction', message: `Server menolak request detail (HTTP ${fatal}). Periksa Api-Key, limit server, dan header.` }, 502);
  if (scanned < totalScan) warnings.push(`Pemindaian terhenti karena batas waktu. Selesai ${scanned} dari ${totalScan} bon; hasil mungkin belum lengkap.`);
  if (failed) warnings.push(`${failed} request detail gagal atau timeout; beberapa transaksi mungkin belum terhitung.`);
  const items = [...found.values()].sort((a, b) => a.plu.localeCompare(b.plu, 'id', { numeric: true }));
  if (items.length && Date.now() < deadline) await enrichMissing(items, storeId, deadline);
  const totalQty = Math.round(items.reduce((sum, x) => sum + x.qty, 0) * 1000) / 1000;
  const result = {
    success: true,
    toko: storeId,
    nik,
    tanggal,
    namaKasir,
    jumlahBon: billWithItems,
    totalBillBerdasarkanLogin: maxBill,
    mulaiBon,
    akhirBon,
    scannedBills: scanned,
    failedBills: failed,
    jumlahPLU: items.length,
    totalQty,
    items,
    warnings,
    durasiMs: Date.now() - start,
    sumber: 'app.alfastore.co.id/prd/api',
  };
  return jsonResult(result);
}

export async function GET(req: Request): Promise<Response> {
  return run(req, null);
}

export async function POST(req: Request): Promise<Response> {
  let posted: JsonMap | null = null;
  try { posted = asObject(await req.json()); }
  catch { return jsonResult({ success: false, message: 'Body wajib JSON.' }, 400); }
  return run(req, posted);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: HTTP_HEADERS });
}
