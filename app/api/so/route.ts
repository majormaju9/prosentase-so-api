/**
 * Satu Route Handler Next.js untuk Entry KKSO.
 * URL browser: /api/so?type=rack|item|cek|save
 * Sumber upstream: app.alfastore.co.id — endpoint rak, item, dan simpan.
 * Cek PLU memakai daftar item rak dan memeriksa indikasi status SO.
 * GET type=save hanya petunjuk, penyimpanan tetap POST dengan validasi status SO.
 * Tanpa SO_PROXY_PASSWORD. Untuk pemakaian publik wajib tambahkan autentikasi pengguna
 * dan pembatasan akses di luar route ini agar API key server tidak disalahgunakan.
 *
 * PENTING: Hanya gunakan akses API yang Anda miliki izinnya.
 * Kredensial HARUS disimpan sebagai Environment Variables Vercel, bukan di HTML.
 * Format respons asli API belum tersedia, sehingga pemetaan data harus divalidasi
 * menggunakan contoh respons aktual sebelum menganggap semua fungsi produksi siap.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const BASE = 'https://app.alfastore.co.id/prd';
const ROUTES = {
  rack: '/api/so/entry_kkso/get_rak_tx_stEntry',
  item: '/api/so/entry_kkso/get_data_entry',
  save: '/api/so/entry_kkso/save_cek_data_entry',
} as const;

type Mode = keyof typeof ROUTES;
type Dict = Record<string, unknown>;

function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, private, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function env(name: string) {
  return (process.env[name] || '').trim();
}

function asRecord(value: unknown): Dict | null {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    ? value as Dict
    : null;
}

function pick(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function convertDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const date = raw.trim();
  const iso = /^(\d{4})-(\d\d)-(\d\d)$/.exec(date);
  const id = /^(\d\d)-(\d\d)-(\d{4})$/.exec(date);
  if (!iso && !id) return null;
  const y = Number(iso ? iso[1] : id![3]);
  const m = Number(iso ? iso[2] : id![2]);
  const d = Number(iso ? iso[3] : id![1]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) return null;
  return `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
}

function verifyStore(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,16}$/.test(value) ? value : null;
}

function verifyRack(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > 0 && value.length <= 50 && /^[A-Za-z0-9_.\/-]+$/.test(value) ? value : null;
}

function verifyPLU(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const plu = raw.trim();
  return /^\d{1,25}$/.test(plu) ? plu : null;
}

function buildHeaders(storeId: string, isPost = false): Headers {
  const h = new Headers({
    'Accept': 'application/json, text/plain, */*',
    'App-Name': env('ALFA_APP_NAME') || 'SO-PDA',
    'Platform': env('ALFA_PLATFORM') || 'ANDROID',
    'Store-Id': storeId,
  });
  if (isPost) h.set('Content-Type', 'application/json; charset=utf-8');

  const optional: Record<string, string> = {
    'Version-App': 'ALFA_VERSION_APP',
    'Version-Code': 'ALFA_VERSION_CODE',
    'User-Agent': 'ALFA_USER_AGENT',
    'App-Uid': 'ALFA_APP_UID',
    'User-Id': 'ALFA_USER_ID',
    'Store-Id-Ext': 'ALFA_STORE_ID_EXT',
    'Shard-Id': 'ALFA_SHARD_ID',
    'Ip-Addr': 'ALFA_IP_ADDR',
    'Sn': 'ALFA_SN',
    'Api-Key': 'ALFA_API_KEY',
    'AndroidId': 'ALFA_ANDROID_ID',
    'Branch-Id': 'ALFA_BRANCH_ID',
    'Class-Store': 'ALFA_CLASS_STORE',
    'Company-Id': 'ALFA_COMPANY_ID',
    'Company-Ext': 'ALFA_COMPANY_EXT',
    'Mac-Addr': 'ALFA_MAC_ADDR',
  };
  for (const [header, key] of Object.entries(optional)) {
    if (env(key)) h.set(header, env(key));
  }
  return h;
}

function getError(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return null;
  const s = String(obj.status ?? '').toLowerCase();
  const ok = obj.success;
  if (ok === false || ok === 0 || obj.status === false || s === 'error' || s === 'failed' || s === 'gagal') {
    const candidate = pick(obj, ['message', 'msg', 'error', 'description']);
    return String(candidate ?? 'Server upstream menolak permintaan').slice(0, 220);
  }
  return null;
}

function rowsFrom(value: unknown, depth = 0): unknown[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) return value;
  const obj = asRecord(value);
  if (!obj) return [];
  for (const key of ['data', 'items', 'result', 'results', 'rows', 'list', 'Data', 'Result', 'payload', 'records', 'content']) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const rows = rowsFrom(obj[key], depth + 1);
      if (rows.length) return rows;
      if (Array.isArray(obj[key])) return [];
    }
  }
  return [];
}

function normalizeRack(raw: unknown): Dict | null {
  const obj = asRecord(raw) || (typeof raw === 'string' ? { rack: raw } : null);
  if (!obj) return null;
  const no = pick(obj, ['rack_no', 'rack', 'rackNo', 'rakSo', 'rak', 'kode_rak', 'rack_code', 'kode', 'idRak', 'RACK_NO']);
  if (no === undefined || String(no).trim() === '') return null;
  const name = pick(obj, ['rack_name', 'rack_descp', 'rack_desc', 'nama_rak', 'description', 'nama', 'descp', 'RACK_NAME']);
  return { ...obj, rack_no: String(no).trim(), rack_name: String(name ?? '') };
}

function normalizeItem(raw: unknown): Dict | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const plu = pick(obj, ['plu', 'plu_no', 'PLU', 'article_code', 'kode', 'item_code', 'pluBarcode']);
  if (plu === undefined) return null;
  const desc = pick(obj, ['item_descp', 'descp', 'description', 'nama', 'desc', 'item_name', 'nama_barang', 'item_desc']);
  const barcode = pick(obj, ['barcode', 'barcode_no', 'Barcode', 'BARCODE']);
  const qty = pick(obj, ['qty', 'QTY', 'jumlah', 'quantity', 'entry_qty']);
  const saldo = pick(obj, ['saldo', 'Saldo', 'SALDO', 'on_hand', 'onHand', 'onhand', 'OH', 'oh', 'stock_on_hand']);
  return {
    ...obj,
    plu: String(plu),
    item_descp: String(desc ?? '-'),
    barcode: String(barcode ?? ''),
    qty: qty === undefined ? 0 : qty,
    // OH dari respons yang sudah ada SAJA — tidak membuat nilai baru.
    ...(saldo !== undefined ? { saldo } : {}),
  };
}

async function upstream(mode: Mode, storeId: string, params: URLSearchParams, body?: Dict) {
  // Gabungkan URL secara eksplisit agar prefix /prd tidak hilang.
  const url = new URL(BASE + ROUTES[mode]);
  for (const [key, value] of params) url.searchParams.set(key, value);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: mode === 'save' ? 'POST' : 'GET',
      headers: buildHeaders(storeId, mode === 'save'),
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(16000),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'Timeout API sumber' : 'API sumber tidak dapat dihubungi';
    return response({ success: false, error: reason }, 502);
  }

  if (res.status >= 300 && res.status < 400) {
    return response({ success: false, error: 'Server sumber meminta pengalihan/login. Periksa autentikasi API.', upstreamStatus: res.status }, 502);
  }
  const text = await res.text();
  if (text.length > 2_000_000) return response({ success: false, error: 'Respons terlalu besar' }, 502);
  let data: unknown;
  try {
    data = text.trim() ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    return response({
      success: false,
      error: `API sumber HTTP ${res.status}`,
      upstreamStatus: res.status,
      upstreamPath: url.pathname,
      message: data ? getError(data) : undefined,
    }, 502);
  }
  if (getError(data)) {
    return response({ success: false, error: getError(data), upstreamStatus: res.status }, 502);
  }
  if (mode === 'save') {
    if (data === null) return response({ success: false, error: 'Respons simpan kosong; hasil belum bisa dipastikan. Periksa data sebelum mengulang.' }, 502);
    const obj = asRecord(data);
    const code = String(obj?.status ?? '').toLowerCase();
    const msg = String(pick(obj || {}, ['message', 'msg', 'description']) ?? '');
    const confirmed = data === true || data === 1 || obj?.success === true || obj?.success === 1 ||
      obj?.status === true || obj?.status === 1 || ['success', 'sukses', 'berhasil', 'ok', '1'].includes(code) ||
      /\b(success|sukses|berhasil|tersimpan|saved)\b/i.test(msg);
    if (!confirmed) return response({ success: false, error: 'Server membalas, tetapi tidak ada konfirmasi jelas bahwa data berhasil disimpan. Periksa hasil sebelum mengulang.', upstreamStatus: res.status }, 502);
    return response({ success: true, message: msg || 'Entry berhasil disimpan', result: data });
  }
  if (data === null) {
    return response({ success: false, error: 'Respons API bukan JSON. Periksa autentikasi atau format server.' }, 502);
  }
  if (mode === 'rack') {
    const rows = rowsFrom(data).map(normalizeRack).filter((x): x is Dict => x !== null);
    return response({ success: true, data: rows });
  }
  if (mode === 'item') {
    const rows = rowsFrom(data).map(normalizeItem).filter((x): x is Dict => x !== null);
    return response({ success: true, data: rows });
  }
  // Pengaman untuk TypeScript jika daftar mode diperluas di kemudian hari.
  return response({ success: false, error: 'Mode API sumber belum didukung' }, 400);
}

/**
 * Validasi status SO defensif berdasarkan atribut respons get_data_entry.
 * Mapping kode st_flag belum terverifikasi sebagai aturan resmi server.
 * Nilai 3 diblokir SEBAGAI PENGAMAN karena pada contoh M2J8/AC7/990091
 * ditemukan st_flag=3 bersamaan dengan peringatan "PLU Sudah Dilakukan Proses SO"
 * di proxy lama. Nilai selain 3 tidak otomatis dinyatakan belum diproses.
 * Opsional: SO_BLOCK_ST_FLAGS=3,4 jika sudah dikonfirmasi dari aturan resmi.
 */
function inspectSOStatus(raw: unknown): { blocked: boolean; reason: string | null; statusFlag: string | null; checked: boolean } {
  const obj = asRecord(raw);
  if (!obj) return { blocked: false, reason: null, statusFlag: null, checked: false };
  const flagRaw = pick(obj, ['st_flag', 'ST_FLAG', 'stFlag']);
  const flag = flagRaw === undefined ? null : String(flagRaw).trim();
  const blockedFlags = (env('SO_BLOCK_ST_FLAGS') || '3')
    .split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  if (flag !== null && blockedFlags.includes(flag)) {
    return { blocked: true, reason: `st_flag=${flag} terindikasi sudah diproses SO`, statusFlag: flag, checked: true };
  }

  const doneFields = ['is_so_done', 'isSoDone', 'so_processed', 'soProcessed', 'already_so', 'alreadySO'];
  for (const key of doneFields) {
    const val = obj[key];
    if (val === true || val === 1 || val === '1' || val === 'true') {
      return { blocked: true, reason: `${key} menunjukkan sudah diproses SO`, statusFlag: flag, checked: true };
    }
  }

  const statusText = pick(obj, [
    'so_message', 'soMessage', 'message_so', 'message', 'msg',
    'status_so', 'so_status', 'statusEntry', 'status_entry', 'keterangan_so',
  ]);
  if (typeof statusText === 'string') {
    const text = statusText.toLowerCase().replace(/[_-]/g, ' ');
    // Jangan salah menandai "belum diproses" sebagai sudah diproses.
    if (!/\b(belum|tidak|not|pending)\b/.test(text) &&
      /(sudah.{0,35}(?:proses|diproses|so|selesai)|(?:so|stock opname).{0,25}(?:selesai|diproses|sudah)|already.{0,20}(?:process|count)|processed so)/i.test(text)) {
      return { blocked: true, reason: String(statusText).slice(0, 150), statusFlag: flag, checked: true };
    }
  }
  return {
    blocked: false,
    reason: null,
    statusFlag: flag,
    checked: flag !== null || typeof statusText === 'string',
  };
}

/**
 * Validasi semua PLU sebelum POST simpan. Mengambil data terbaru dari sumber;
 * GAGAL tertutup bila status tidak bisa dicek, barang tak ditemukan, atau
 * ada indikasi sudah proses SO. Tidak mengubah endpoint/item/save yang lama.
 * Ini belum bisa menjamin tidak ada perubahan status antara cek dan simpan;
 * validasi final tetap harus ada di sistem sumber.
 */
async function validateBeforeSave(storeId: string, dateSo: string, items: Dict[]): Promise<Response | null> {
  const byRack = new Map<string, Dict[]>();
  for (const item of items) {
    const rack = String(item.rack);
    const group = byRack.get(rack) || [];
    group.push(item);
    byRack.set(rack, group);
  }
  if (byRack.size > 12) {
    return response({ success: false, error: 'Maksimal 12 rak per permintaan simpan untuk pemeriksaan status SO.' }, 400);
  }
  // Pemeriksaan terpisah per rak agar seluruh item dicek SEBELUM satu pun dikirim untuk disimpan.
  for (const [rack, group] of byRack) {
    const params = new URLSearchParams({ kodeToko: storeId, dateSo, rakSo: rack });
    const result = await upstream('item', storeId, params);
    if (!result.ok) {
      return response({
        success: false,
        error: 'Tidak dapat memverifikasi status SO. Penyimpanan dibatalkan agar tidak terjadi duplikasi.',
        rack,
        upstreamStatus: result.status,
      }, 502);
    }
    let document: unknown;
    try { document = await result.json(); } catch {
      return response({ success: false, error: 'Respons pemeriksaan status SO tidak valid. Penyimpanan dibatalkan.' }, 502);
    }
    const loaded = asRecord(document);
    const records = Array.isArray(loaded?.data) ? loaded.data : [];
    for (const item of group) {
      const plu = String(item.plu);
      const found = records.find((row) => {
        const obj = asRecord(row);
        return obj && String(obj.plu ?? '').trim() === plu;
      });
      if (!found) {
        return response({ success: false, error: 'PLU tidak ditemukan pada data ENTRY KKSO rak. Simpan dibatalkan.', plu, rack }, 409);
      }
      const statusSO = inspectSOStatus(found);
      if (statusSO.blocked) {
        return response({
          success: false,
          status: false,
          error: 'PLU Sudah Dilakukan Proses SO',
          message: 'Penyimpanan dibatalkan: status SO perlu diverifikasi agar tidak terjadi entry ulang.',
          plu,
          rack,
          statusFlag: statusSO.statusFlag,
          validationMode: 'entry-rack-status',
        }, 409);
      }
    }
  }
  return null;
}

/**
 * Fallback aman untuk cek PLU tanpa parameter sesi menu.
 * Tidak memanggil cek_plu_rak_bebas dengan nilai tiruan. Sebagai gantinya,
 * mencari PLU/barcode yang memang ada dalam daftar ENTRY KKSO rak terkait.
 * Ini BUKAN pengganti penuh validasi PLU rak bebas.
 */
async function checkFromEntryRack(storeId: string, dateSo: string, rack: string, pluOrBarcode: string): Promise<Response> {
  const qs = new URLSearchParams({ kodeToko: storeId, dateSo, rakSo: rack });
  const result = await upstream('item', storeId, qs);
  if (!result.ok) return result;

  let decoded: unknown;
  try {
    decoded = await result.json();
  } catch {
    return response({ success: false, error: 'Data item rak bukan JSON.' }, 502);
  }
  const data = asRecord(decoded);
  const rows = Array.isArray(data?.data) ? data.data : [];
  const searched = pluOrBarcode.trim();
  const found = rows.find((raw) => {
    const obj = asRecord(raw);
    if (!obj) return false;
    return [obj.plu, obj.barcode, obj.barcode_no].some(
      (value) => value !== undefined && String(value).trim() === searched
    );
  });
  if (!found) {
    return response({
      success: false,
      error: 'PLU/barcode tidak ditemukan pada data ENTRY KKSO untuk rak ini.',
      lookupMode: 'entry-rack',
      note: 'Untuk memeriksa barang di luar daftar entry rak, gunakan cek_plu_rak_bebas dengan parameter menuList, lang, userSo dari sesi resmi.',
    }, 404);
  }
  const soStatus = inspectSOStatus(found);
  if (soStatus.blocked) {
    return response({
      success: false,
      status: false,
      error: 'PLU Sudah Dilakukan Proses SO',
      message: 'PLU terindikasi telah diproses SO; jangan entry ulang tanpa konfirmasi dari sistem resmi.',
      plu: searched,
      rack,
      statusFlag: soStatus.statusFlag,
      lookupMode: 'entry-rack',
      validationMode: 'entry-rack-status',
    }, 409);
  }
  return response({ success: true, data: found, lookupMode: 'entry-rack',
    soStatus: soStatus.checked ? 'tidak_terindikasi_diproses' : 'tidak_dapat_dipastikan' });
}

function configurationError(): Response | null {
  // Tidak menggunakan SO_PROXY_PASSWORD / X-SO-Access.
  // API key sumber tetap hanya dibaca di server dan tidak dikirim ke browser.
  if (!env('ALFA_API_KEY')) {
    return response({ success: false, error: 'ALFA_API_KEY belum diatur di Environment Variables Vercel.' }, 503);
  }
  return null;
}

export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams;
  const mode = qs.get('type');
  if (mode === 'save') {
    // Dibuka lewat browser => GET. Tampilkan petunjuk, JANGAN melakukan penyimpanan.
    return response({
      success: true,
      ready: !!env('ALFA_API_KEY'),
      message: 'Endpoint save tersedia. Untuk menyimpan ENTRY KKSO gunakan POST dengan body JSON.',
      method: 'POST',
      endpoint: '/api/so?type=save',
      requiredBody: ['kodeToko', 'dateSo', 'data'],
      note: 'GET ini hanya informasi; tidak mengirim atau menyimpan data.',
    });
  }
  const locked = configurationError();
  if (locked) return locked;
  if (mode !== 'rack' && mode !== 'item' && mode !== 'cek') return response({ success: false, error: 'type GET harus rack, item, cek, atau save (info POST)' }, 400);
  const store = verifyStore(qs.get('storeId'));
  const date = convertDate(qs.get('date'));
  if (!store || !date) return response({ success: false, error: 'storeId atau date tidak valid' }, 400);
  const params = new URLSearchParams();
  if (mode === 'rack') {
    params.set('storeId', store);
    params.set('dateSo', date);
  } else if (mode === 'item') {
    const rack = verifyRack(qs.get('rack'));
    if (!rack) return response({ success: false, error: 'rack tidak valid' }, 400);
    params.set('kodeToko', store);
    params.set('dateSo', date);
    params.set('rakSo', rack);
  } else {
    const rack = verifyRack(qs.get('rack'));
    const plu = verifyPLU(qs.get('plu'));
    if (!rack || !plu) return response({ success: false, error: 'rack atau plu tidak valid' }, 400);
    // Mode cek: cari PLU/barcode di data ENTRY KKSO untuk rak terpilih.
    // Tidak membutuhkan parameter sesi menu, bahasa, atau userSo.
    // Data di luar rak tidak dapat ditemukan dengan metode ini.
    return checkFromEntryRack(store, date, rack, plu);
  }
  return upstream(mode, store, params);
}

export async function POST(req: Request) {
  const locked = configurationError();
  if (locked) return locked;
  if (new URL(req.url).searchParams.get('type') !== 'save') return response({ success: false, error: 'type POST harus save' }, 400);
  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) return response({ success: false, error: 'Content-Type harus application/json' }, 415);
  const rawText = await req.text();
  if (rawText.length > 200_000) return response({ success: false, error: 'Body terlalu besar' }, 413);
  let input: unknown;
  try { input = JSON.parse(rawText); } catch { return response({ success: false, error: 'Body JSON tidak valid' }, 400); }
  const obj = asRecord(input);
  const store = obj ? verifyStore(obj.kodeToko) : null;
  const date = obj ? convertDate(obj.dateSo) : null;
  if (!store || !date || !obj || !Array.isArray(obj.data) || obj.data.length < 1 || obj.data.length > 250) {
    return response({ success: false, error: 'Body harus kodeToko, dateSo, data (1–250 item)' }, 400);
  }
  const data: Dict[] = [];
  for (const raw of obj.data as unknown[]) {
    const item = asRecord(raw);
    if (!item) return response({ success: false, error: 'Ada item bukan objek JSON' }, 400);
    const plu = verifyPLU(String(item.plu ?? ''));
    const rack = verifyRack(String(item.rack ?? ''));
    const qty = Number(item.qty);
    if (!plu || !rack || !Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0 || qty > 1_000_000) {
      return response({ success: false, error: 'PLU, rack, atau qty item tidak valid' }, 400);
    }
    const rawDate = String(item.date ?? date);
    const itemDate = convertDate(rawDate);
    if (!itemDate) return response({ success: false, error: 'date item tidak valid' }, 400);
    data.push({
      avg_cost: String(item.avg_cost ?? '0'),
      barcode: String(item.barcode ?? ''),
      date: env('SO_ITEM_DATE_FORMAT') === 'ISO' ? `${itemDate.slice(6)}-${itemDate.slice(3, 5)}-${itemDate.slice(0, 2)}` : itemDate,
      f_tag: String(item.f_tag ?? '0'),
      item_descp: String(item.item_descp ?? ''),
      plu,
      qty, // 0 dikirim sebagai angka 0; jangan menyamarkan menjadi string "00".
      rack,
      tag: String(item.tag ?? ''),
    });
  }
  // Jangan teruskan POST bila PLU berindikasi sudah proses SO.
  const blocked = await validateBeforeSave(store, date, data);
  if (blocked) return blocked;
  return upstream('save', store, new URLSearchParams(), { kodeToko: store, dateSo: date, data });
}
