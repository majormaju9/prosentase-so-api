/**
 * app/api/sql/route.ts
 * Penjualan per NIK — rekap kasir dan pencarian detail PLU berdasarkan nomor bon dari APK THOR v15.1.1.
 * Tidak melakukan cek_login atau memanggil endpoint login.
 *
 * Upstream: GET /prd/api/rpt/laporan/penjualan_per_kasir
 * Query rekap: storeId, userId, periode1 (dd-MM-yyyy)
 * Detail PLU: POST /prd/api/pos/transaksi/retur/get_transaction
 * Body berdasarkan APK: storeId, dateTx, userId, billNo
 * API key hanya berasal dari variabel lingkungan server ALFA_API_KEY.
 *
 * Perbaikan: header CORS untuk alfastore.my.id, diagnostik kegagalan bon, dan perlindungan scan massal.
 * PERHATIAN: file ini menggantikan /api/sql jika route itu sudah ada.
 * Simpan salinan route /api/sql lama sebelum mengganti karena mungkin dipakai fitur lain.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VERSION = '2026-11-18-cors-detail-diagnostic-v4';
const TRANSACTION_PATH = 'pos/transaksi/retur/get_transaction';
const UPSTREAM_BASE = 'https://app.alfastore.co.id/prd/api/';
const REPORT_PATH = 'rpt/laporan/penjualan_per_kasir';
const MAX_BODY_CHARS = 1_000_000;

interface Kasir {
  nik: string;
  nama: string;
  jumlahBon: number;
  transaksi: number;
  qty: number;
  return: number;
  void: number;
  diskonHemat: number;
  netLP: number;
  bagiHasil: number;
  totalPrice: number;
}

function sendJson(data: object, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

function wibToday(): string {
  // formatToParts lebih stabil untuk yyyy-MM-dd daripada format en-CA di berbagai runtime.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (key: string) => parts.find(x => x.type === key)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toPeriode(dateTx: string): string {
  const [y, m, d] = dateTx.split('-');
  return `${d}-${m}-${y}`;
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', hellip: '…',
  };
  return text.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (original: string, code: string) => {
    if (code.startsWith('#')) {
      const hex = code[1]?.toLowerCase() === 'x';
      const n = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n) : original;
    }
    return named[code.toLowerCase()] ?? original;
  });
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' '))
    .replace(/[\s\u00a0]+/g, ' ').trim();
}

function readInteger(raw: string): number | null {
  let val = raw.replace(/[\s\u00a0]/g, '').replace(/[^\d.,\-]/g, '');
  if (!val || !/^-?[\d.,]+$/.test(val)) return null;
  // Contoh nyata: 2,602,200 dan 53,100 adalah pemisah ribuan.
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(val)) val = val.replace(/[.,]/g, '');
  else if (/^-?\d+$/.test(val)) { /* angka tanpa separator */ }
  else return null; // format desimal/ambigu tidak ditafsir sebagai nilai lain
  const n = Number(val);
  return Number.isSafeInteger(n) ? n : null;
}

/** Ekstraksi tabel HTML hanya untuk baris dengan NIK dan 11 kolom asli. */
function parseKasirRows(html: string): Kasir[] {
  const table = html.match(/<table\b[^>]*class\s*=\s*["'][^"']*\bdatatable\b[^"']*["'][^>]*>[\s\S]*?<\/table\s*>/i);
  const source = table?.[0] ?? html; // fallback jika atribut class HTML berubah
  const tbody = source.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody\s*>/i);
  const rowSource = tbody?.[1] ?? source;
  const rows: Kasir[] = [];
  const rowMatches = rowSource.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi);

  for (const row of rowMatches) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)]
      .map(cell => plainText(cell[1]));
    if (cells.length !== 11) continue;
    const nik = cells[0].replace(/\s/g, '');
    if (!/^\d{4,12}$/.test(nik)) continue; // abaikan header/total/footer
    const numbers = cells.slice(2).map(readInteger);
    if (numbers.some(x => x === null)) continue;
    rows.push({
      nik, nama: cells[1],
      jumlahBon: numbers[0]!, transaksi: numbers[1]!, qty: numbers[2]!,
      return: numbers[3]!, void: numbers[4]!,
      diskonHemat: numbers[5]!, netLP: numbers[6]!,
      bagiHasil: numbers[7]!, totalPrice: numbers[8]!,
    });
  }
  return rows;
}

function extractErrorFromHtml(raw: string): { message: string; code: string } | null {
  const shortText = plainText(raw).slice(0, 600);
  if (/report\s+ditolak|belum\s+melakukan\s+eod/i.test(raw))
    return { code: 'EOD_REQUIRED', message: 'Laporan ditolak oleh Alfastore: toko belum melakukan EOD.' };
  if (/<title[^>]*>\s*(?:404|400|403|500|502)(?:\s|<|\s+error)/i.test(raw) ||
      /\b(?:404 Not Found|400 Bad Request|403 Forbidden)\b/i.test(shortText))
    return { code: 'UPSTREAM_HTML_ERROR', message: shortText.slice(0, 250) || 'Alfastore mengirim halaman kesalahan HTML.' };
  return null;
}

async function getReport(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const storeId = (p.get('storeId') ?? '').trim().toUpperCase();
  const nik = (p.get('nik') ?? p.get('userId') ?? '').trim();
  const dateTx = (p.get('dateTx') ?? wibToday()).trim();
  const branchId = (p.get('branchId') ?? process.env.ALFA_BRANCH_ID ?? 'MZ01').trim().toUpperCase();
  const apiKey = process.env.ALFA_API_KEY ?? '';

  if ((!storeId && !nik) || p.get('mode') === 'health') {
    return sendJson({
      ok: true, status: 'route-ready', version: VERSION, path: '/api/sql',
      apiKeyConfigured: Boolean(apiKey), loginRequired: false,
      upstreamEndpoint: `/prd/api/${REPORT_PATH}`,
      responseType: 'rekap-kasir', qtyScope: 'per-kasir',
      message: 'Route aktif. Masukkan storeId, nik, dateTx untuk membaca QTY pada baris NIK dalam laporan HTML.',
      example: '/api/sql?storeId=M865&nik=20020884&dateTx=2026-11-17&branchId=MZ01',
    });
  }
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) return sendJson({ok:false,message:'storeId wajib 4-8 karakter huruf atau angka.'}, 400);
  if (!/^\d{4,12}$/.test(nik)) return sendJson({ok:false,message:'NIK wajib 4-12 digit angka.'}, 400);
  if (!validDate(dateTx)) return sendJson({ok:false,message:'dateTx wajib berupa tanggal valid yyyy-MM-dd.'}, 400);
  if (!/^[A-Z0-9_-]{2,12}$/.test(branchId)) return sendJson({ok:false,message:'branchId tidak valid.'}, 400);
  if (!apiKey) return sendJson({ok:false,code:'MISSING_API_KEY',message:'ALFA_API_KEY belum disetel di Environment Variables Vercel.'}, 503);

  const periode1 = toPeriode(dateTx);
  const upstreamUrl = new URL(REPORT_PATH, UPSTREAM_BASE);
  upstreamUrl.search = new URLSearchParams({storeId, userId:nik, periode1}).toString();
  const headers: Record<string,string> = {
    'Accept': 'text/html, application/json, */*',
    'Content-Type': 'application/json',
    'Api-Key': apiKey,
    'App-Name': process.env.ALFA_APP_NAME || 'InventoryIntelligence',
    'Platform': process.env.ALFA_PLATFORM || 'ANDROID',
    'Store-Id': storeId,
    'User-Id': (process.env.ALFA_USER_ID || nik).trim(),
    'Branch-Id': branchId,
    'User-Agent': process.env.ALFA_USER_AGENT || 'python-requests/2.28.2',
  };

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET', headers, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(25000),
    });
    const raw = (await upstream.text()).slice(0, MAX_BODY_CHARS);
    const htmlError = extractErrorFromHtml(raw);
    if (!upstream.ok || htmlError || upstream.status >= 300) {
      return sendJson({
        ok: false, status: 'upstream-error',
        code: htmlError?.code ?? 'UPSTREAM_HTTP_ERROR',
        message: htmlError?.message ?? `Alfastore menolak permintaan (HTTP ${upstream.status}).`,
        upstreamStatus: upstream.status, endpoint: `/prd/api/${REPORT_PATH}`,
        storeId, nik, dateTx, branchId, periode1,
      }, htmlError?.code === 'EOD_REQUIRED' ? 409 : 502);
    }

    // Endpoint laporan ini menghasilkan HTML. Jika JSON, jelaskan jelas, jangan mengarang QTY.
    const looksHtml = /<\s*(?:!doctype\s+html|html\b|table\b|body\b)/i.test(raw);
    if (!looksHtml) {
      return sendJson({
        ok: false, code: 'UNEXPECTED_FORMAT',
        message: 'Respons Alfastore bukan tabel HTML laporan per kasir; struktur data perlu diperiksa.',
        upstreamStatus: upstream.status, endpoint: `/prd/api/${REPORT_PATH}`,
        format: 'non-html', storeId, nik, dateTx,
      }, 502);
    }

    const rows = parseKasirRows(raw);
    if (!rows.length) {
      return sendJson({
        ok: false, code: 'TABLE_NOT_FOUND',
        message: 'Laporan HTML diterima tetapi tabel penjualan per kasir dengan 11 kolom tidak ditemukan.',
        upstreamStatus: upstream.status, endpoint: `/prd/api/${REPORT_PATH}`,
        format: 'html', storeId, nik, dateTx,
      }, 502);
    }
    const target = rows.find(row => row.nik === nik);
    if (!target) {
      return sendJson({
        ok: false, status: 'nik-not-found', code: 'NIK_NOT_FOUND',
        message: `NIK ${nik} tidak ada dalam tabel laporan toko ${storeId} pada ${dateTx}.`,
        upstreamStatus: upstream.status, endpoint: `/prd/api/${REPORT_PATH}`,
        storeId, nik, dateTx, periode1,
      }, 404);
    }

    return sendJson({
      ok: true, status: 'success', version: VERSION, source: 'Alfastore', mode: 'report-html',
      storeId, nik, dateTx, branchId, periode1,
      upstreamStatus: upstream.status, endpoint: `/prd/api/${REPORT_PATH}`,
      format: 'html', qtyAvailable: true, qtyScope: 'kasir',
      pluAvailable: false, totalPLU: null,
      totalQty: target.qty, totalBon: target.jumlahBon, totalTrs: target.transaksi,
      totalPenjualan: target.totalPrice,
      kasir: target,
      message: 'Berhasil membaca data penjualan dan QTY untuk NIK yang diminta.',
      note: 'QTY berasal dari kolom Qty pada laporan Penjualan Per Kasir. Laporan ini tidak berisi detail PLU/barcode tiap barang.',
      // Tidak menyertakan seluruh HTML agar NIK dan penjualan kasir lain tidak ikut tersebar.
    });
  } catch (e) {
    const timeout = e instanceof Error && /timeout|abort/i.test(e.name + ' ' + e.message);
    return sendJson({
      ok: false, status: 'connection-error', code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_CONNECTION_ERROR',
      message: timeout ? 'Alfastore tidak menjawab dalam 25 detik.' : 'Koneksi ke Alfastore gagal.',
    }, 502);
  }
}


interface SaleItem {
  plu: string;
  barcode: string;
  nama: string;
  qty: number;
  billNos: string[];
}
type BillResult = {
  billNo: string;
  status: 'found' | 'empty' | 'not-found' | 'error';
  items: SaleItem[];
  message?: string;
  upstreamStatus?: number;
  responseKeys?: string[];
  errorCode?: string;
};

function safeFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}
function str(v: unknown): string { return v === undefined || v === null ? '' : String(v).trim(); }
function qtyNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = str(v).replace(/\s/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  return null;
}

/**
 * APK menunjukkan JSON untuk detail bon, tetapi nama pembungkus data dapat berbeda.
 * Pilih satu array detail paling kuat; jangan hitung satu item beberapa kali karena
 * JSON mengulang data pada beberapa bagian.
 */
function parseSaleItems(root: unknown, billNo: string): SaleItem[] {
  type Candidate = { entries: SaleItem[]; score: number };
  const candidates: Candidate[] = [];
  const visited = new Set<object>();
  const seenDepthLimit = 12;
  let nodes = 0;
  const mapLine = (v: unknown): SaleItem | null => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const plu = str(safeFirst(o, ['plu','PLU','plu_code','pluCode','kd_plu','kode_plu','kodePlu','item_code','itemCode']));
    const q = qtyNumber(safeFirst(o,['qty_pcs','qtyPcs','qty','QTY','quantity','qty_jual','qtyJual','qty_sal','qtySal','qty_sold']));
    if (!/^\d{3,16}$/.test(plu) || q === null || Math.abs(q) > 1_000_000) return null;
    const barcode = str(safeFirst(o,['barcode','barCode','barcode_item','barcodeItem','ean','ean13','kode_barcode']));
    const nama = str(safeFirst(o,['descp','description','deskripsi','desc','nama_barang','namaBarang','nama_item','namaItem','item_name','itemName','product_name','productName','name']));
    return {plu, barcode, nama, qty:q, billNos:[billNo]};
  };
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > seenDepthLimit || ++nodes > 12000) return;
    if (visited.has(value as object)) return;
    visited.add(value as object);
    if (Array.isArray(value)) {
      const lines = value.map(mapLine).filter((x): x is SaleItem => x !== null);
      if (lines.length) {
        const score = lines.length * 100 + lines.filter(x => x.nama).length * 8 + lines.filter(x => x.barcode).length * 3;
        candidates.push({entries:lines, score});
      }
      for (const entry of value) walk(entry, depth+1);
    } else {
      const obj = value as Record<string, unknown>;
      for (const child of Object.values(obj)) walk(child,depth+1);
    }
  };
  walk(root,0);
  if (candidates.length) {
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0].entries;
  }
  // Sebagian versi API mengembalikan satu detail item sebagai object.
  const item = mapLine(root);
  return item ? [item] : [];
}
function decodeMaybeJson(raw: string): unknown | null {
  let s = raw.trim();
  if (s.startsWith('200^')) s = s.slice(4).trim();
  try {
    const parsed: unknown = JSON.parse(s);
    if (typeof parsed === 'string' && /^[\[{]/.test(parsed.trim())) {
      try { return JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch { return null; }
}
function apiHeaders(storeId:string, nik:string, branchId:string): Record<string,string> {
  return {
    'Accept':'application/json, text/plain, */*',
    'Content-Type':'application/json',
    'Api-Key':process.env.ALFA_API_KEY || '',
    'App-Name':process.env.ALFA_APP_NAME || 'InventoryIntelligence',
    'Platform':process.env.ALFA_PLATFORM || 'ANDROID',
    'Store-Id':storeId,
    'User-Id':(process.env.ALFA_USER_ID || nik).trim(),
    'Branch-Id':branchId,
    'User-Agent':process.env.ALFA_USER_AGENT || 'python-requests/2.28.2',
  };
}
function parseError(body: string): string {
  const parsed=decodeMaybeJson(body);
  if (parsed && typeof parsed === 'object') {
    const o=parsed as Record<string,unknown>;
    return str(o.message || o.error || o.msg).slice(0,240);
  }
  return plainText(body).slice(0,180);
}
async function fetchBill(storeId:string,nik:string,dateTx:string,branchId:string,billNo:string):Promise<BillResult> {
  const url = new URL(TRANSACTION_PATH, UPSTREAM_BASE);
  const payload = {storeId,dateTx,userId:nik,billNo: /^\d+$/.test(billNo) ? Number(billNo):billNo};
  try {
    const r = await fetch(url, {
      method:'POST', headers:apiHeaders(storeId,nik,branchId),
      body:JSON.stringify(payload), cache:'no-store',redirect:'manual',
      signal:AbortSignal.timeout(11000),
    });
    const raw=(await r.text()).slice(0,250000);
    const json=decodeMaybeJson(raw);
    if (!r.ok || r.status >= 300) {
      const msg=parseError(raw) || `HTTP ${r.status}`;
      const notFound = /bon.{0,36}(tidak|not).{0,18}(ditemukan|found)|transaction not found|data tidak ditemukan/i.test(msg);
      const html = /^\s*</.test(raw);
      const code = html && r.status === 404 ? 'ENDPOINT_404_HTML' : 'UPSTREAM_HTTP_'+r.status;
      const description = code === 'ENDPOINT_404_HTML'
        ? 'Endpoint detail transaksi mengirim HTTP 404 HTML. Jalur API kemungkinan tidak tersedia untuk koneksi ini; mengganti rentang bon tidak memperbaiki 404 endpoint.'
        : `Alfastore HTTP ${r.status}: ${msg}`;
      return {billNo,status:notFound?'not-found':'error',items:[],message:notFound?msg:description.slice(0,250),upstreamStatus:r.status,errorCode:notFound?'BILL_NOT_FOUND':code};
    }
    if (!json || typeof json !== 'object') {
      return {billNo,status:'error',items:[],message:'Endpoint detail mengembalikan HTML/teks, bukan JSON transaksi, meskipun HTTP 200.',upstreamStatus:r.status,errorCode:'NON_JSON_RESPONSE'};
    }
    const obj=json as Record<string,unknown>;
    const successFlag=obj.ok === false || obj.success === false || (typeof obj.status==='string' && /^(error|failed)$/i.test(obj.status));
    if (successFlag) {
      return {billNo,status:'error',items:[],message:str(obj.message || obj.error).slice(0,220)||'API menolak bon.',upstreamStatus:r.status,errorCode:'UPSTREAM_REJECTED'};
    }
    const items=parseSaleItems(json,billNo);
    if (!items.length) {
      return {billNo,status:'empty',items:[],message:'JSON diterima, tetapi pasangan PLU + qty tidak ditemukan.',upstreamStatus:r.status,responseKeys:Object.keys(obj).slice(0,20),errorCode:'PLU_SCHEMA_NOT_FOUND'};
    }
    return {billNo,status:'found',items,upstreamStatus:r.status};
  } catch(e) {
    const err=e instanceof Error ? e.message : 'Koneksi gagal';
    return {billNo,status:'error',items:[],message:err.slice(0,200),errorCode:'UPSTREAM_CONNECTION_ERROR'};
  }
}
function aggregate(results:BillResult[]):SaleItem[] {
  const map=new Map<string,SaleItem>();
  for (const result of results) for (const item of result.items) {
    const key=item.plu;
    const prev=map.get(key);
    if (!prev) map.set(key,{...item,billNos:[result.billNo]});
    else {
      prev.qty=Number((prev.qty+item.qty).toFixed(3));
      if (!prev.nama && item.nama) prev.nama=item.nama;
      if (!prev.barcode && item.barcode) prev.barcode=item.barcode;
      if (!prev.billNos.includes(result.billNo)) prev.billNos.push(result.billNo);
    }
  }
  return [...map.values()].sort((a,b)=>a.plu.localeCompare(b.plu,'en',{numeric:true}));
}
function dateTodayWib():string { return wibToday(); }

async function handleGet(request:Request):Promise<Response> {
  const p = new URL(request.url).searchParams;
  const mode=(p.get('mode') || 'report').toLowerCase();
  if (mode==='health' || (!p.get('nik') && !p.get('storeId'))) {
    return sendJson({ok:true,status:'route-ready',version:VERSION,path:'/api/sql',apiKeyConfigured:Boolean(process.env.ALFA_API_KEY),loginRequired:false,
      modes:['report','plu','detail'],
      reportEndpoint:`/prd/api/${REPORT_PATH}`,detailEndpoint:`/prd/api/${TRANSACTION_PATH}`,
      detailVerifiedOnline:false,
      message:'Rekap dari laporan HTML; PLU menggunakan detail bon APK THOR, perlu verifikasi respons API.',
      exampleReport:'/api/sql?storeId=M865&nik=20020884&dateTx=2026-11-17&branchId=MZ01',
      examplePLU:'/api/sql?storeId=M865&nik=20020884&dateTx=2026-11-17&branchId=MZ01&mode=plu&billFrom=1&billTo=25',
    });
  }
  if (mode === 'report') return getReport(request);
  if (mode !== 'plu' && mode !== 'detail') return sendJson({ok:false,message:'mode hanya report, plu, detail, health.'},400);
  const storeId=str(p.get('storeId')).toUpperCase();
  const nik=str(p.get('nik') || p.get('userId'));
  const dateTx=str(p.get('dateTx') || dateTodayWib());
  const branchId=str(p.get('branchId') || process.env.ALFA_BRANCH_ID || 'MZ01').toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(storeId) || !/^\d{4,12}$/.test(nik) || !validDate(dateTx) || !/^[A-Z0-9_-]{2,12}$/.test(branchId))
    return sendJson({ok:false,code:'INVALID_PARAMETERS',message:'Parameter storeId, nik, dateTx, atau branchId tidak valid.'},400);
  if (!process.env.ALFA_API_KEY) return sendJson({ok:false,code:'MISSING_API_KEY',message:'ALFA_API_KEY belum disetel di Vercel.'},503);

  if (mode==='detail') {
    const billNo=str(p.get('billNo'));
    if (!/^[A-Z0-9_-]{1,40}$/i.test(billNo)) return sendJson({ok:false,message:'Isi billNo untuk mengambil detail satu bon.'},400);
    const result=await fetchBill(storeId,nik,dateTx,branchId,billNo);
    const items=aggregate([result]);
    return sendJson({ok:result.status==='found',status:result.status,mode:'detail',version:VERSION,storeId,nik,dateTx,branchId,
      endpoint:`/prd/api/${TRANSACTION_PATH}`,billNo,items,pluAvailable:items.length>0,
      totalPLU:items.length,totalQty:items.length ? items.reduce((v,i)=>v+i.qty,0):null,
      message:result.message || (items.length?'PLU bon ditemukan.':'Tidak ada PLU untuk bon ini.'),
      responseKeys:result.responseKeys,upstreamStatus:result.upstreamStatus,errorCode:result.errorCode,
      note:'Detail hanya mencakup billNo yang diminta. Nama/barcode ditampilkan jika tersedia pada respons.'},result.status==='error'?502:200);
  }

  const from=Number(p.get('billFrom') || '1');
  const to=Number(p.get('billTo') || '25');
  // Batasi beban upstream. Web menggabungkan halaman secara bertahap.
  if (!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to-from+1>25||to>2000)
    return sendJson({ok:false,code:'INVALID_BILL_RANGE',message:'Rentang billFrom/billTo harus 1-2000 dan maksimal 25 nomor bon per permintaan.'},400);
  const numbers=Array.from({length:to-from+1},(_,i)=>String(from+i));
  const out:BillResult[]=[];
  // Uji 1-3 bon dahulu. Hindari 70 kegagalan identik ketika endpoint tidak tersedia.
  // No. Bon laporan adalah JUMLAH bon, bukan nomor bon urut.
  const first=await fetchBill(storeId,nik,dateTx,branchId,numbers[0]);
  out.push(first);
  const blockingCode = first.status==='error' && (
    ['ENDPOINT_404_HTML','NON_JSON_RESPONSE','UPSTREAM_HTTP_400','UPSTREAM_HTTP_401','UPSTREAM_HTTP_403',
      'UPSTREAM_HTTP_405','UPSTREAM_HTTP_415','UPSTREAM_HTTP_422','UPSTREAM_REJECTED'].includes(first.errorCode||'')
    || first.upstreamStatus === 403 || first.upstreamStatus === 401
  );
  if (blockingCode) {
    return sendJson({
      ok:false,status:'detail-endpoint-rejected',mode:'plu',version:VERSION,stopRecommended:true,
      code:first.errorCode||'ENDPOINT_UNAVAILABLE',
      message:`Uji bon ${first.billNo} gagal: ${first.message}. Pemindaian dihentikan untuk menghindari permintaan gagal berulang. Coba mode=detail dengan nomor bon asli, dan periksa endpoint/detail parameter.`,
      storeId,nik,dateTx,branchId,endpoint:`/prd/api/${TRANSACTION_PATH}`,
      billFrom:from,billTo:to,requestedBon:numbers.length,attemptedBon:1,
      foundBon:[],emptyBon:[],notFoundBon:[],failedBon:[first],diagnostic:[],items:[],
      pluAvailable:false,totalPLU:null,totalQty:null,complete:false,
    },502);
  }
  // Bila 3 nomor awal semuanya tidak ditemukan, hentikan scan massal secara konservatif.
  // Pengguna dapat menguji billNo sebenarnya tanpa menebak nomor bon urut.
  for(let i=1;i<Math.min(3,numbers.length);i++) {
    out.push(await fetchBill(storeId,nik,dateTx,branchId,numbers[i]));
    if (out[i].status==='error' && ['ENDPOINT_404_HTML','NON_JSON_RESPONSE','UPSTREAM_HTTP_401','UPSTREAM_HTTP_403'].includes(out[i].errorCode||'')) break;
  }
  const initialBroken = out.some(x=>x.status==='error' && ['ENDPOINT_404_HTML','NON_JSON_RESPONSE','UPSTREAM_HTTP_401','UPSTREAM_HTTP_403'].includes(x.errorCode||''));
  const allNotFound = numbers.length>3 && out.length===3 && out.every(x=>x.status==='not-found');
  if (!initialBroken && !allNotFound) {
    let cursor=out.length;
    const worker=async()=>{
      while(cursor<numbers.length) {
        const index=cursor++;
        out[index]=await fetchBill(storeId,nik,dateTx,branchId,numbers[index]);
      }
    };
    await Promise.all(Array.from({length:Math.min(3,numbers.length-out.length)},()=>worker()));
  }
  const found=out.filter(x=>x?.status==='found');
  const empty=out.filter(x=>x?.status==='empty');
  const errors=out.filter(x=>x?.status==='error');
  const notFound=out.filter(x=>x?.status==='not-found');
  const items=aggregate(out.filter(Boolean));
  const stopRecommended=initialBroken||allNotFound;
  const firstError=errors[0];
  return sendJson({
    ok:found.length>0, status:found.length?'partial-detail':stopRecommended?'scan-stopped':'no-detail',mode:'plu',version:VERSION,
    storeId,nik,dateTx,branchId,endpoint:`/prd/api/${TRANSACTION_PATH}`,
    billFrom:from,billTo:to,requestedBon:numbers.length,attemptedBon:out.filter(Boolean).length,
    foundBon:found.map(x=>x.billNo),emptyBon:empty.map(x=>x.billNo),notFoundBon:notFound.map(x=>x.billNo),
    failedBon:errors.map(x=>({billNo:x.billNo,message:x.message,upstreamStatus:x.upstreamStatus,errorCode:x.errorCode})),
    diagnostic:empty.slice(0,2).map(x=>({billNo:x.billNo,responseKeys:x.responseKeys,errorCode:x.errorCode})),
    items,pluAvailable:items.length>0,totalPLU:items.length||null,
    totalQty:items.length?items.reduce((sum,x)=>sum+x.qty,0):null,
    complete:false,stopRecommended,firstErrorCode:firstError?.errorCode,
    note:'No. Bon di laporan rekap adalah JUMLAH bon, bukan daftar nomor bon. Scan hanya uji nomor perkiraan; tidak menjamin PLU lengkap.',
    message:stopRecommended
      ? (allNotFound ? `Tiga nomor awal ${from}-${from+2} tidak ditemukan. Dihentikan agar tidak mengirim puluhan percobaan bon yang belum terbukti benar. Gunakan billNo asli.` : `Pemindaian dihentikan karena error detail: ${firstError?.message||'Endpoint belum tersedia'}.`)
      : found.length?`Berhasil membaca ${found.length} bon dalam rentang ${from}-${to}.`:
        `Belum ada PLU yang dapat dibaca. Bon yang gagal: ${errors.length}; bon tidak ditemukan: ${notFound.length}; respons tanpa PLU: ${empty.length}.`,
  },found.length?200:502);
}


/** CORS khusus website cPanel milik pengguna; tidak membuka akses semua origin. */
function corsHeaders(request: Request): Headers {
  const headers=new Headers();
  const origin=request.headers.get('origin')||'';
  if (['https://alfastore.my.id','https://www.alfastore.my.id',
       'https://majormaju9-prosentase-so-api.vercel.app'].includes(origin) ||
       /^http:\/\/localhost(?::\d+)?$/.test(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
    headers.set('Access-Control-Max-Age', '3600');
  }
  headers.set('Vary', 'Origin');
  return headers;
}
export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null,{status:204,headers:corsHeaders(request)});
}
export async function GET(request: Request): Promise<Response> {
  try {
    const response=await handleGet(request);
    corsHeaders(request).forEach((value,key)=>response.headers.set(key,value));
    return response;
  } catch (err) {
    const response=sendJson({ok:false,code:'UNHANDLED_ERROR',message:'Kesalahan internal saat memproses permintaan.'},500);
    corsHeaders(request).forEach((value,key)=>response.headers.set(key,value));
    return response;
  }
}
