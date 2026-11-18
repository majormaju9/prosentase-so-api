/**
 * Vercel / Next.js App Router
 * Install at: app/api/sql/route.ts
 * Public URL: https://majormaju9-prosentase-so-api.vercel.app/api/sql
 *
 * Headers stay on this server only. DO NOT paste Api-Key into index.html.
 * Note: This route contains a server-side key, so use a private repository and server-side rate limiting.
 * Rotate the key if this source has ever been published.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UPSTREAM_ORIGIN = 'https://app.alfastore.co.id';
const UPSTREAM_ROOT = `${UPSTREAM_ORIGIN}/prd/api/`;
const PROD_ORIGIN = 'https://majormaju9-prosentase-so-api.vercel.app';

// Headers from the user's test screenshot. These are SERVER-SIDE only.
const AUTH = {
  apiKey: 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG',
  appName: 'InventoryIntelligence',
  platform: 'ANDROID',
  userAgent: 'python-requests/2.28.2',
  defaultBranchId: 'MZ01',
} as const;

const MAX_BILL_NO = 250; // Batas pengujian nomor bon manual tanpa mencari jumlah bon melalui login.
const BATCH_SIZE = 12;
const PARALLEL_FETCHES = 6;
const UPSTREAM_TIMEOUT_MS = 9000;

type PlainObject = Record<string, unknown>;
type Input = { storeId: string; nik: string; dateTx: string; branchId: string };
type Item = { plu: string; barcode: string; name: string; qty: number };

function isObject(value: unknown): value is PlainObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function allowedOrigin(origin: string | null): boolean {
  return !origin || origin === 'null' || origin === PROD_ORIGIN || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin);
}

function response(data: unknown, status = 200, origin: string | null = null): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  };
  // Explicitly allow the deployed test page and a locally opened HTML file.
  // CORS does not replace authentication or protect a public server endpoint.
  if (origin && allowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message: string, status = 400, origin: string | null = null): Response {
  return response({ success: false, message }, status, origin);
}

function checkDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

function parseInput(body: PlainObject): Input {
  const storeId = String(body.storeId ?? '').trim().toUpperCase();
  const nik = String(body.nik ?? body.userId ?? '').trim();
  const dateTx = String(body.dateTx ?? '').trim();
  const branchId = String(body.branchId ?? AUTH.defaultBranchId).trim().toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) throw new Error('Kode toko harus 4–8 huruf/angka.');
  if (!/^\d{6,12}$/.test(nik)) throw new Error('NIK harus 6–12 digit angka.');
  if (!checkDate(dateTx)) throw new Error('Tanggal wajib dalam format YYYY-MM-DD yang valid.');
  if (!/^[A-Z0-9]{2,8}$/.test(branchId)) throw new Error('Branch ID harus 2–8 huruf/angka.');
  return { storeId, nik, dateTx, branchId };
}

function authHeaders(input: Input): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': AUTH.userAgent,
    'Api-Key': AUTH.apiKey,
    'App-Name': AUTH.appName,
    'Platform': AUTH.platform,
    'Store-Id': input.storeId,
    'User-Id': input.nik,
    'Branch-Id': input.branchId,
    'Accept-Encoding': 'gzip',
  });
  // Host & Connection are managed by fetch / HTTP transport automatically.
  return headers;
}

function decodeUpstream(raw: string): unknown {
  let source = raw.trim().replace(/^\uFEFF/, '');
  // THOR's network helper represents responses as "200^{...}", "200^[...]".
  // A real HTTP endpoint may instead send JSON directly.
  const prefixed = source.match(/^(\d{3})\^([\s\S]*)$/);
  if (prefixed) {
    const code = Number(prefixed[1]);
    if (code === 204) return [];
    if (code < 200 || code >= 300) throw new Error(`Layanan ALFASTORE mengembalikan kode ${code}.`);
    source = prefixed[2].trim();
  }
  if (!source) return null;
  try { return JSON.parse(source); }
  catch { throw new Error('Respons ALFASTORE bukan JSON yang valid.'); }
}

async function upstream(input: Input, path: string, method: 'GET'|'POST', data?: unknown): Promise<unknown> {
  // No arbitrary URLs or paths from the browser are allowed here.
  const allowed = ['pos/transaksi/retur/get_transaction', 'sis/master/inventory/lov_items'];
  const endpointPath = path.split('?')[0];
  if (!allowed.includes(endpointPath)) throw new Error('Endpoint tidak diizinkan.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(`${UPSTREAM_ROOT}${path}`, {
      method,
      headers: authHeaders(input),
      body: method === 'POST' ? JSON.stringify(data ?? {}) : undefined,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    const raw = await upstreamResponse.text();
    if (!upstreamResponse.ok && upstreamResponse.status !== 204) {
      // Do not relay error response bodies (may contain internal data).
      throw new Error(`ALFASTORE HTTP ${upstreamResponse.status} pada ${endpointPath}.`);
    }
    if (upstreamResponse.status === 204) return [];
    return decodeUpstream(raw);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`ALFASTORE timeout setelah ${UPSTREAM_TIMEOUT_MS / 1000} detik.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function asArray(data: unknown): PlainObject[] {
  if (Array.isArray(data)) return data.filter(isObject);
  if (isObject(data)) {
    for (const key of ['data', 'items', 'result', 'rows']) {
      if (Array.isArray(data[key])) return (data[key] as unknown[]).filter(isObject);
    }
  }
  throw new Error('Format daftar transaksi tidak sesuai (bukan array).');
}

function itemFromRow(row: PlainObject): Item | null {
  const rawPlu = row.plu;
  if (rawPlu == null || String(rawPlu).trim() === '') return null;
  const qtyRaw = row.qty ?? 0;
  const qty = typeof qtyRaw === 'number' ? qtyRaw : Number(String(qtyRaw).replace(',', '.'));
  if (!Number.isFinite(qty)) return null;
  const plu = String(rawPlu).trim();
  return {
    plu,
    barcode: String(row.barcode ?? '').trim(),
    name: String(row.desc ?? row.descp ?? row.name ?? '').trim() || `Item ${plu}`,
    qty,
  };
}

function aggregateRows(rows: PlainObject[], items: Map<string, Item>): void {
  for (const row of rows) {
    const item = itemFromRow(row);
    if (!item) continue;
    const old = items.get(item.plu);
    if (!old) { items.set(item.plu, item); continue; }
    old.qty += item.qty;
    if ((!old.name || old.name.startsWith('Item ')) && !item.name.startsWith('Item ')) old.name = item.name;
    if (!old.barcode && item.barcode) old.barcode = item.barcode;
  }
}

async function parallelMap<T>(tasks: T[], workers: number, fn: (task: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      await fn(tasks[index]);
    }
  }));
}

async function detail(input: Input, body: PlainObject): Promise<PlainObject> {
  const start = Number(body.startBillNo);
  const end = Number(body.endBillNo);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > MAX_BILL_NO || end - start + 1 > BATCH_SIZE) {
    throw new Error(`Rentang billNo harus 1–${MAX_BILL_NO} dan maksimum ${BATCH_SIZE} bon per permintaan.`);
  }
  const items = new Map<string, Item>();
  const failedBills: { billNo: number; message: string }[] = [];
  let successfulBills = 0;
  let nonEmptyBills = 0;
  const bills = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  await parallelMap(bills, PARALLEL_FETCHES, async (billNo) => {
    try {
      const result = await upstream(input, 'pos/transaksi/retur/get_transaction', 'POST', {
        storeId: input.storeId,
        dateTx: input.dateTx,
        userId: input.nik,
        billNo,
      });
      const rows = asArray(result);
      successfulBills++;
      if (rows.length) nonEmptyBills++;
      aggregateRows(rows, items);
    } catch (err) {
      failedBills.push({ billNo, message: err instanceof Error ? err.message : 'Request gagal.' });
    }
  });
  return {
    success: true,
    startBillNo: start,
    endBillNo: end,
    checkedBills: bills.length,
    successfulBills,
    nonEmptyBills,
    failedBills: failedBills.sort((a, b) => a.billNo - b.billNo),
    items: [...items.values()].sort((a, b) => a.plu.localeCompare(b.plu, 'id')),
  };
}

async function lookup(input: Input, body: PlainObject): Promise<PlainObject> {
  if (!Array.isArray(body.plus)) throw new Error('Kirim daftar PLU pada field plus.');
  const plus = [...new Set(body.plus.map(String).map(s => s.trim()))];
  if (plus.length < 1 || plus.length > 8 || plus.some(plu => !/^[A-Za-z0-9]{1,20}$/.test(plu))) {
    throw new Error('Isi 1–8 PLU (maksimum 20 karakter).');
  }
  const results: { plu: string; name: string; barcode: string }[] = [];
  const warnings: string[] = [];
  await parallelMap(plus, 4, async (plu) => {
    try {
      const q = new URLSearchParams({ storeId: input.storeId, searchValue: plu });
      const arr = asArray(await upstream(input, `sis/master/inventory/lov_items?${q}`, 'GET'));
      const row = arr.find(r => String(r.plu ?? '') === plu);
      if (row) results.push({ plu, name: String(row.descp ?? row.desc ?? '').trim(), barcode: String(row.barcode ?? '').trim() });
    } catch (_err) {
      warnings.push(`PLU ${plu} gagal dilengkapi.`);
    }
  });
  return { success: true, results, warnings };
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!allowedOrigin(origin)) return errorResponse('Origin tidak diizinkan.', 403);
  return response({ success: true }, 200, origin);
}

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!allowedOrigin(origin)) return errorResponse('Origin tidak diizinkan.', 403);
  return response({
    success: true,
    service: 'THOR Penjualan per NIK',
    method: 'POST',
    actions: ['detail', 'lookup'],
    note: 'API detail transaksi aktif. Kirim storeId, nik, dateTx, dan rentang startBillNo/endBillNo untuk action detail.',
  }, 200, origin);
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!allowedOrigin(origin)) return errorResponse('Origin tidak diizinkan.', 403);
  try {
    const raw = await request.text();
    if (raw.length > 3000) return errorResponse('Ukuran request terlalu besar.', 413, origin);
    let value: unknown;
    try { value = JSON.parse(raw); }
    catch { return errorResponse('Body harus JSON yang valid.', 400, origin); }
    if (!isObject(value)) return errorResponse('Body harus objek JSON.', 400, origin);
    const input = parseInput(value);
    let result: PlainObject;
    switch (value.action) {
      case 'detail': result = await detail(input, value); break;
      case 'lookup': result = await lookup(input, value); break;
      default: return errorResponse('Action harus detail atau lookup.', 400, origin);
    }
    return response(result, 200, origin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Kesalahan server tidak diketahui.';
    const badInput = /^(Kode toko|NIK|Tanggal|Branch ID|Rentang billNo|Kirim daftar|Isi 1–8)/.test(msg);
    return errorResponse(msg, badInput ? 400 : 502, origin);
  }
}
