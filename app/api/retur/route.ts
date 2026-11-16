export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BASE = 'https://app.alfastore.co.id/prd/api/';
const PREFIX = 'sis/transaksi/retur_pembelian/';

// Semua header SIS berada di file server ini.
// Store/User/Branch mengikuti form masuk agar sama dengan parameter transaksi.
const SIS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'python-requests/2.28.2',
  'Api-Key': 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG',
  'App-Name': 'InventoryIntelligence',
  'Platform': 'ANDROID',
  'Store-Id': 'M865',
  'User-Id': '20020884',
  'Branch-Id': 'MZ01',
  'Host': 'app.alfastore.co.id',
  'Connection': 'Keep-Alive',
  'Accept-Encoding': 'gzip',
};
function sisHeaders(ctx: Context): Headers {
  return new Headers({...SIS_HEADERS,
    'Store-Id': ctx.storeId,
    'User-Id': ctx.userId,
    'Branch-Id': ctx.branchId,
  });
}

const actions: Record<string, {path: string; method: string; fallback?: string}> = {
  menu_status: {path: 'sis/retur/menu_status/', method: 'GET'},
  cek_menu: {path: PREFIX + 'cek_menu', method: 'GET'},
  lov_supp: {path: PREFIX + 'lov_supp', method: 'GET'},
  lov: {path: PREFIX + 'lov', method: 'GET'},
  search_item_retur: {path: PREFIX + 'search_item_retur', method: 'POST'},
  get_faktur: {path: PREFIX + 'get_faktur', method: 'GET', fallback: 'POST'},
  lov_retur_draft: {path: PREFIX + 'lov_retur_draft', method: 'GET'},
  get_item_draft: {path: PREFIX + 'get_item_draft', method: 'GET'},
  delete_item_draft: {path: PREFIX + 'delete_item_draft', method: 'GET'},
  save_retur: {path: PREFIX + 'save_retur', method: 'POST'},
};
type Context = {storeId: string; userId: string; branchId: string};
function allowedStore(store: string) {
  return (process.env.RETUR_ALLOWED_STORES || SIS_HEADERS['Store-Id']).split(',').map(s => s.trim().toUpperCase()).includes(store);
}
function cors(request: Request) {
  const headers = new Headers({'Cache-Control':'private, no-store', 'Vary':'Origin', 'X-Content-Type-Options':'nosniff'});
  const origin = request.headers.get('origin');
  const allowed = (process.env.RETUR_ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (origin && (origin === new URL(request.url).origin || allowed.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return headers;
}
function reply(request: Request, data: unknown, status = 200) {
  return Response.json(data, {status, headers: cors(request)});
}
export async function OPTIONS(request: Request) { return new Response(null, {status:204, headers:cors(request)}); }
function today() {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
  return parts.replaceAll('/', '-');
}
function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function fail(message: string): never { throw new Error(message); }
function payload(action: string, input: Record<string, unknown>, ctx: Context) {
  const storeDate = today();
  const basic: Record<string, unknown> = {storeId:ctx.storeId,userId:ctx.userId,storeDate};
  const supplierId = text(input.supplierId), keterangan = text(input.keterangan);
  const jenisBarang = text(input.jenisBarang) || 'REGULER';
  const noFaktur = text(input.noFaktur);
  const search = text(input.search_value);
  switch (action) {
    case 'menu_status': return {storeId:ctx.storeId};
    case 'cek_menu': return {storeId:ctx.storeId,userId:ctx.userId};
    case 'lov_supp': return {...basic,search_value:search,keterangan};
    case 'lov_retur_draft': return {storeId:ctx.storeId,returnType:'DC',jenisBarang};
    case 'get_item_draft':
    case 'delete_item_draft':
      if (!noFaktur || noFaktur.length > 100) fail('Nomor faktur wajib diisi.');
      return {storeId:ctx.storeId,noFaktur,jenisBarang,...(action === 'get_item_draft' ? {returnType:'DC'} : {})};
    case 'get_faktur':
      if (!supplierId || !keterangan) fail('Pilih supplier dan keterangan.');
      return {...basic,supplierId,supp_id:supplierId,keterangan,returnType:'DC',jenisBarang,destination_retur:'DC',retur_class:'DC',jns_menu:'DC'};
    case 'lov':
    case 'search_item_retur': {
      if (!supplierId || !keterangan) fail('Pilih supplier dan keterangan.');
      const p: Record<string,unknown> = {...basic,store_id:ctx.storeId,supplierId,supp_id:supplierId,keterangan,search_value:search,searchValue:search,inputSearch:search};
      if (noFaktur) Object.assign(p,{faktur:noFaktur,no_faktur:noFaktur,noFaktur});
      if (action === 'lov') Object.assign(p,{returnType:'DC',noLpb:text(input.noLpb),unlockProcess:'False',page:Math.max(1,Math.min(10000,Number(input.page)||1))});
      return p;
    }
    case 'save_retur': {
      if (!supplierId || !keterangan || !noFaktur) fail('Supplier, keterangan, dan nomor faktur wajib diisi.');
      if (input.statusRetur !== 'DRAFT' && input.statusRetur !== 'FIXED') fail('Status retur tidak valid.');
      if (!Array.isArray(input.data) || !input.data.length || input.data.length > 1000) fail('Daftar barang kosong atau terlalu besar.');
      for (const item of input.data) {
        if (!item || typeof item !== 'object' || !/^\d+$/.test(String(item.plu)) || !Number.isInteger(item.qty) || item.qty <= 0) fail('PLU dan jumlah barang tidak valid.');
      }
      // Metadata dan flag item berasal dari respons SIS, tidak dipalsukan menjadi NOOTP.
      const p: Record<string,unknown> = {storeId:ctx.storeId,dateTx:storeDate,noFaktur,no_faktur:noFaktur,userId:ctx.userId,
        userName:text(input.userName),returnType:'DC',retur_class:'DC',retur_cls:'DC',supplierId,
        statusRetur:input.statusRetur,status_retur:input.statusRetur,keterangan,jenisBarang,jenis_barang:jenisBarang,flagMemo:5,data:input.data};
      for (const key of ['timeTx','locationType','affiliasi','kdStore','noLpb','no_lpb','fakturPo','noFakturPo','no_faktur_po','faktur_po','otp']) {
        if (typeof input[key] === 'string' && input[key]) p[key] = input[key];
      }
      return p;
    }
    default: return fail('Aksi tidak dikenal.');
  }
}
async function handle(request: Request) {
  let input: Record<string,unknown>;
  const url = new URL(request.url);
  try {
    if (request.method === 'POST') {
      const raw = await request.text();
      if (raw.length > 2_000_000) return reply(request,{ok:false,message:'Permintaan terlalu besar.'},413);
      input = JSON.parse(raw);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    } else input = Object.fromEntries(url.searchParams);
  } catch { return reply(request,{ok:false,message:'Body JSON tidak valid.'},400); }
  const action = text(input.action) || url.searchParams.get('action') || '';
  const storeId = (text(input.storeId) || SIS_HEADERS['Store-Id']).toUpperCase();
  const userId = text(input.userId) || SIS_HEADERS['User-Id'];
  const branchId = (text(input.branchId) || SIS_HEADERS['Branch-Id']).toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(storeId) || !/^\d{8}$/.test(userId) || !/^[A-Z0-9]{2,12}$/.test(branchId)) {
    return reply(request,{ok:false,message:'Isi kode toko 4 karakter, NIK 8 angka, dan kode cabang/DC yang benar.'},400);
  }
  if (!allowedStore(storeId)) return reply(request,{ok:false,message:'Kode toko belum diizinkan pada RETUR_ALLOWED_STORES.'},403);
  const ctx: Context = {storeId,userId,branchId};
  if (action === 'connect') {
    if (request.method !== 'POST') return reply(request,{ok:false,message:'Gunakan POST.'},405);
    return reply(request,{ok:true,context:ctx});
  }
  const spec = actions[action];
  if (!spec) return reply(request,{ok:false,message:'Aksi tidak dikenal.'},400);
  // Semua aksi penulisan, termasuk GET penghapusan upstream, wajib POST pada gateway.
  if (['get_faktur','delete_item_draft','save_retur'].includes(action) && request.method !== 'POST') return reply(request,{ok:false,message:'Aksi ini wajib POST.'},405);
  if (['delete_item_draft','save_retur'].includes(action) && input.confirm !== true) return reply(request,{ok:false,message:'Konfirmasi transaksi diperlukan.'},400);
  let params: Record<string,unknown>;
  try { params = payload(action,input,ctx); } catch (error) { return reply(request,{ok:false,message:(error as Error).message},400); }
  const headers = sisHeaders(ctx);
  async function send(method: string) {
    const upstream = new URL(spec.path,BASE);
    if (method === 'GET') for (const [key,value] of Object.entries(params)) upstream.searchParams.set(key,String(value));
    return fetch(upstream,{method,headers,body:method === 'POST' ? JSON.stringify(params) : undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)});
  }
  try {
    let response = await send(spec.method);
    if (response.status === 405 && spec.fallback) {
      params = {...params, store_id:ctx.storeId, user_id:ctx.userId};
      response = await send(spec.fallback);
    }
    let raw = (await response.text()).replace(/^\d{3}\^/,'').trim();
    let data: unknown;
    try { data = raw ? JSON.parse(raw) : null; }
    catch {
      return reply(request,{ok:false,upstreamStatus:response.status,message:'SIS mengembalikan respons non-JSON. Periksa akses, sesi dan header server.'},502);
    }
    const body = data && typeof data === 'object' ? data as Record<string,unknown> : {};
    const statusCode = String(body.statusCode ?? body.status_code ?? body.code ?? '');
    const rejected = body.success === false || body.status === false || /^(error|failed|failure)$/i.test(String(body.status || '')) || /^[45]\d\d$/.test(statusCode);
    const ok = response.ok && !rejected && data !== null;
    return reply(request,{ok,upstreamStatus:response.status,data,message:typeof body.message === 'string' ? body.message : ok ? '' : 'Permintaan ditolak atau respons SIS kosong.'},ok ? 200 : response.ok ? 422 : response.status);
  } catch (error) {
    const uncertain = ['save_retur','delete_item_draft','get_faktur'].includes(action);
    return reply(request,{ok:false,uncertain,message:uncertain ? 'Respons transaksi belum diterima. Periksa daftar draft sebelum mengulangi agar tidak terjadi transaksi ganda.' : 'Tidak dapat terhubung ke SIS. Periksa koneksi dan konfigurasi akses.'},502);
  }
}
export const GET = handle;
export const POST = handle;
