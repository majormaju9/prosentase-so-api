/**
 * Pasang di app/api/save-per-item/route.ts (Next.js App Router).
 * URL: /api/save-per-item?storeId=M992&date=23-09-2026
 * GET hanya petunjuk; penyimpanan harus POST application/json.
 * Body mengikuti tangkapan layar, contoh struktur (isi dengan data asli):
 * { kodeToko, dateSo, rakSo, data: [
 *   { plu, descp, conv1, conv2, subdept, barcode, tag, qty, avg_cost }
 * ] }
 *
 * Header akses asli diteruskan dari request: Api-Key, User-Id, Branch-Id,
 * AndroidId, Mac-Addr, Authorization, App-Uid, dll. Jangan gunakan identitas
 * toko/perangkat lain. Alternatif untuk backend satu toko: ALFA_API_KEY,
 * ALFA_USER_ID, ALFA_BRANCH_ID, ALFA_ANDROID_ID, ALFA_MAC_ADDR,
 * ALFA_AUTHORIZATION dan ALFA_STORE_ID di environment server.
 * Jika memakai kredensial environment, ALFA_STORE_ID wajib mengikat toko.
 * Lindungi route dengan autentikasi/otorisasi aplikasi sebelum dipublikasikan
 * menggunakan kredensial environment bersama. Tidak ada kunci hardcoded.
 *
 * Opsional: ALFA_ALLOWED_ORIGIN untuk frontend beda domain (origin persis).
 * Tidak ada retry/fallback otomatis karena bisa menyebabkan simpan ganda.
 * Gambar sukses menunjukkan save_entry_kkso; file ini sengaja menggunakan
 * save_per_item sesuai permintaan. Kontrak POST endpoint ini perlu diuji
 * memakai sesi dan data toko yang valid; belum diverifikasi di server asli.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENDPOINT = 'https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item';
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string' ? v.trim() : '';

function reply(req: Request, value: Obj, status = 200): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' });
  const origin = req.headers.get('origin');
  if (origin && origin === process.env.ALFA_ALLOWED_ORIGIN) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Api-Key, User-Id, Branch-Id, AndroidId, Mac-Addr, Authorization, Store-Id, App-Uid, Store-Id-Ext, Shard-Id, Ip-Addr, Sn, Class-Store, Company-Id, Company-Ext, Version-App, Version-Code');
  }
  return new Response(JSON.stringify(value), { status, headers });
}
function fail(req: Request, message: string, status = 400, extra: Obj = {}) {
  return reply(req, { success: false, saved: false, message, ...extra }, status);
}
function validDate(value: string): boolean {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return d.getUTCFullYear() === +m[3] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[1];
}
export async function OPTIONS(req: Request) { return reply(req, { methods: ['GET', 'POST', 'OPTIONS'] }); }
export async function GET(req: Request) {
  return reply(req, { active: true, saved: false, message: 'Route aktif. Belum ada data disimpan. Gunakan POST JSON dengan rakSo dan data barang.', method: 'POST' });
}
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin && origin !== process.env.ALFA_ALLOWED_ORIGIN) {
    return fail(req, 'Origin tidak diizinkan.', 403);
  }
  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) return fail(req, 'Gunakan Content-Type application/json.', 415);
  let body: unknown;
  try { body = await req.json(); } catch { return fail(req, 'Body JSON tidak valid.'); }
  if (!object(body)) return fail(req, 'Body harus berupa objek JSON.');
  const q = new URL(req.url).searchParams;
  const queryStore = str(q.get('storeId')).toUpperCase();
  const bodyStore = str(body.kodeToko).toUpperCase();
  const queryDate = str(q.get('date'));
  const bodyDate = str(body.dateSo);
  if (queryStore && bodyStore && queryStore !== bodyStore) return fail(req, 'storeId dan kodeToko berbeda.');
  if (queryDate && bodyDate && queryDate !== bodyDate) return fail(req, 'date dan dateSo berbeda.');
  const storeId = queryStore || bodyStore;
  const date = queryDate || bodyDate;
  if (!/^[A-Z0-9]{4}$/.test(storeId)) return fail(req, 'Kode toko harus 4 huruf/angka.');
  if (!validDate(date)) return fail(req, 'Tanggal harus valid dalam format DD-MM-YYYY.');
  const headerStore = str(req.headers.get('store-id')).toUpperCase();
  if (headerStore && headerStore !== storeId) return fail(req, 'Header Store-Id berbeda dari toko tujuan.');
  const rakSo = str(body.rakSo);
  if (!rakSo || !Array.isArray(body.data) || !body.data.length) return fail(req, 'rakSo dan data barang tidak boleh kosong.');
  for (let i = 0; i < body.data.length; i++) {
    const item: unknown = body.data[i];
    if (!object(item)) return fail(req, `Barang ke-${i + 1} harus objek.`);
    for (const field of ['plu', 'descp', 'conv1', 'conv2', 'subdept', 'barcode', 'tag', 'qty', 'avg_cost']) {
      if (item[field] === undefined || item[field] === null) return fail(req, `Barang ke-${i + 1}: ${field} wajib diisi.`);
    }
    for (const field of ['plu', 'conv1', 'conv2', 'subdept', 'qty', 'avg_cost']) {
      const v = item[field];
      if ((typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '' || !Number.isFinite(Number(v))) return fail(req, `Barang ke-${i + 1}: ${field} harus angka valid.`);
    }
    // Pertahankan qty=0, barcode dengan nol di depan, dan metadata asli.
  }
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8', 'App-Name': 'SO-PDA', Platform: 'ANDROID', 'Version-App': 'V.2026.04.13.01-alfa', 'Version-Code': '28', 'Store-Id': storeId });
  const mapping: Record<string, string> = {
    'Api-Key': 'ALFA_API_KEY', 'User-Id': 'ALFA_USER_ID', 'Branch-Id': 'ALFA_BRANCH_ID',
    AndroidId: 'ALFA_ANDROID_ID', 'Mac-Addr': 'ALFA_MAC_ADDR', Authorization: 'ALFA_AUTHORIZATION',
    'App-Uid': 'ALFA_APP_UID', 'Store-Id-Ext': 'ALFA_STORE_ID_EXT', 'Shard-Id': 'ALFA_SHARD_ID',
    'Ip-Addr': 'ALFA_IP_ADDR', Sn: 'ALFA_SN', 'Class-Store': 'ALFA_CLASS_STORE',
    'Company-Id': 'ALFA_COMPANY_ID', 'Company-Ext': 'ALFA_COMPANY_EXT',
    'Version-App': 'ALFA_VERSION_APP', 'Version-Code': 'ALFA_VERSION_CODE',
  };
  let serverIdentity = false;
  for (const [name, env] of Object.entries(mapping)) {
    const fromRequest = req.headers.get(name);
    const value = fromRequest || process.env[env];
    if (!fromRequest && value && !name.startsWith('Version-')) serverIdentity = true;
    if (value) headers.set(name, value);
  }
  if (serverIdentity && str(process.env.ALFA_STORE_ID).toUpperCase() !== storeId) return fail(req, 'Kredensial server harus terikat ke toko melalui ALFA_STORE_ID.', 403);
  if (!headers.get('Api-Key') || !headers.get('User-Id')) return fail(req, 'Api-Key dan User-Id asli wajib tersedia melalui header atau environment server.', 401);
  const url = new URL(ENDPOINT);
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('date', date);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ kodeToko: storeId, dateSo: date, rakSo, data: body.data }), cache: 'no-store', redirect: 'manual', signal: controller.signal });
    const raw = await upstream.text();
    let result: unknown;
    try { result = JSON.parse(raw); } catch { result = null; }
    const resultObj = object(result) ? result : {};
    const info = str(resultObj.infoMsg);
    // Konfirmasi positif harus datang dari server; HTTP 200/201 saja tidak cukup.
    const confirmed = /^berhasil\s+simpan\s+entry\s+kkso[.!]?$/i.test(info);
    const rejected = resultObj.success === false || resultObj.success === 'false' || resultObj.success === 0 || !!resultObj.error || !!resultObj.errorMsg;
    if (upstream.ok && confirmed && !rejected) {
      return reply(req, { success: true, saved: true, message: info, infoMsg: info, storeId, date, upstreamStatus: upstream.status }, upstream.status);
    }
    return fail(req, upstream.ok ? 'Server belum memberikan konfirmasi Berhasil Simpan Entry KKSO. Periksa data sebelum mencoba lagi.' : 'Server menolak penyimpanan. Periksa kredensial dan data barang.', upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502, {
      saved: null, upstreamStatus: upstream.status,
      // Jangan pantulkan seluruh respons yang mungkin mengandung data sensitif.
      infoMsg: info || str(resultObj.message) || str(resultObj.errorMsg) || 'Respons server tidak dikenali.',
    });
  } catch {
    return fail(req, 'Koneksi terputus atau timeout. Status simpan belum diketahui; cek KKSO sebelum mengirim ulang.', 504, { saved: null });
  } finally { clearTimeout(timer); }
}
