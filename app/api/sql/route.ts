/**
 * THOR Penjualan per NIK - API Vercel
 * Path: app/api/sql/route.ts
 * Tidak memakai so/login/cek_login atau input bon awal/akhir.
 *
 * PENJELASAN TEKNIS: APK THOR memakai bill_no untuk get_transaction.
 * Sumber laporan di bawah dicoba untuk mencari nomor bon / data item secara otomatis.
 * Jika keduanya tidak menyediakannya, API mengembalikan error yang jujur;
 * tidak mengklaim "semua penjualan" atau mengembalikan sukses palsu.
 *
 * Header disimpan di server. JANGAN unggah route.ts ke public_html atau repo publik.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE = 'https://app.alfastore.co.id/prd/api/';
const TEST_ORIGIN = 'https://majormaju9-prosentase-so-api.vercel.app';
// Key lama dipertahankan dari file route.ts yang dikirim sebelumnya.
// Sebaiknya pindahkan nilainya ke environment variable SQL_UPSTREAM_API_KEY.
const LEGACY_API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const KEY = process.env.SQL_UPSTREAM_API_KEY || LEGACY_API_KEY;
const APP_NAME = 'InventoryIntelligence';
const TIMEOUT = 12500;
const MAX_BON = 300; // Batas kerja untuk menjaga API upstream; bukan klaim cakupan semua bon.
const MAX_BATCH = 12;
const MAX_ROWS = 20000;

type Obj = Record<string, unknown>;
type ReqInput = { storeId: string; nik: string; dateTx: string; branchId: string };
type Item = { plu: string; barcode: string; name: string; qty: number };

type SourceDiagnostic = { source: string; status: string };
const sources = [
  'rpt/laporan/laporan_penjualan_per_nomor_bon',
  'rpt/laporan/penjualan_per_kasir',
] as const;
function obj(x: unknown): x is Obj { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function pick(o: Obj, names: string[]): unknown { for (const name of names) if (o[name] !== undefined && o[name] !== null) return o[name]; return undefined; }
function text(x: unknown): string { return x === null || x === undefined ? '' : String(x).trim(); }
function originAllowed(origin: string | null): boolean {
  return !origin || origin === 'null' || origin === TEST_ORIGIN || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(origin);
}
function reply(data: unknown, code = 200, origin: string | null = null): Response {
  const headers: Record<string,string> = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Vary':'Origin' };
  if (origin && originAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return new Response(JSON.stringify(data), {status:code, headers});
}
function fail(message: string, status = 400, origin: string | null = null, extra: Obj = {}): Response {
  return reply({success:false, message, ...extra}, status, origin);
}
function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y,m,d] = v.split('-').map(Number), t = new Date(Date.UTC(y,m-1,d));
  return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m && t.getUTCDate() === d;
}
function inputOf(value: Obj): ReqInput {
  const storeId = text(value.storeId).toUpperCase();
  const nik = text(value.nik ?? value.userId);
  const dateTx = text(value.dateTx);
  const branchId = text(value.branchId || 'MZ01').toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(storeId)) throw new Error('Kode toko harus 4–8 huruf/angka.');
  if (!/^\d{6,12}$/.test(nik)) throw new Error('NIK harus 6–12 digit angka.');
  if (!validDate(dateTx)) throw new Error('Tanggal harus YYYY-MM-DD yang valid.');
  if (!/^[A-Z0-9]{2,8}$/.test(branchId)) throw new Error('Branch ID tidak valid.');
  return {storeId,nik,dateTx,branchId};
}
function headersFor(input: ReqInput): Headers {
  return new Headers({
    'Content-Type':'application/json', 'Accept':'application/json',
    'User-Agent':'python-requests/2.28.2', 'Api-Key':KEY,
    'App-Name':APP_NAME, 'Platform':'ANDROID',
    'Store-Id':input.storeId, 'User-Id':input.nik,
    'Branch-Id':input.branchId, 'Accept-Encoding':'gzip',
  });
}
function parseUpstream(body: string): unknown {
  let trimmed = body.trim().replace(/^\uFEFF/, '');
  const prefix = /^(\d{3})\^([\s\S]*)$/.exec(trimmed);
  if (prefix) {
    if (+prefix[1] < 200 || +prefix[1] >= 300) throw new Error(`Kode upstream ${prefix[1]}`);
    trimmed = prefix[2].trim();
  }
  if (!trimmed) return null;
  try { return JSON.parse(trimmed); }
  catch { throw new Error('Respons laporan bukan JSON (mungkin HTML atau file report).'); }
}
async function requestUpstream(input: ReqInput, endpoint: string, method: 'GET'|'POST', body?: unknown): Promise<unknown> {
  const path = endpoint.split('?')[0];
  if (![...sources, 'pos/transaksi/retur/get_transaction', 'sis/master/inventory/lov_items'].includes(path as typeof sources[number])) throw new Error('Endpoint tidak diizinkan.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(BASE+endpoint, {
      method, headers: headersFor(input), body: method==='POST'?JSON.stringify(body ?? {}):undefined,
      cache:'no-store', signal:controller.signal, redirect:'error',
    });
    const raw = await res.text();
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`ALFASTORE HTTP ${res.status} pada ${path}.`);
    return parseUpstream(raw);
  } catch(e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(`ALFASTORE timeout ${TIMEOUT/1000} detik pada ${path}.`);
    throw e;
  } finally { clearTimeout(timeout); }
}
// Normalisasi respons berlapis: data, result, rows, list, items, payload dll.
// Tidak melakukan iterasi acak: hanya ambil baris objek dengan batas jumlah.
function collectRows(value: unknown): Obj[] {
  const result: Obj[] = [];
  const seen = new Set<unknown>();
  function walk(v: unknown, depth: number): void {
    if (depth > 6 || result.length >= MAX_ROWS || v == null || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x,depth+1); return; }
    if (!obj(v)) return;
    const keys = Object.keys(v);
    if (keys.some(k => ['plu','PLU','bill_no','billNo','noBon','nomor_bon','jumlahBon','totalBon','billCount','qty'].includes(k))) result.push(v);
    for (const key of ['data','rows','items','result','results','list','payload','records','report','dataList','details','transaksi','content']) {
      if (key in v) walk(v[key],depth+1);
    }
  }
  walk(value,0);
  return result;
}
function qtyNumber(value: unknown): number {
  if (typeof value==='number') return value;
  const s = text(value).replace(',', '.');
  return s ? Number(s) : NaN;
}
function itemFromRow(row: Obj): Item | null {
  const plu = text(pick(row,['plu','PLU','pluCode','productCode','product_code']));
  const qty = qtyNumber(pick(row,['qty','QTY','quantity','qtyPcs','qty_pcs','qtyJual','totalQty']));
  if (!plu || !Number.isFinite(qty)) return null;
  return {
    plu, barcode:text(pick(row,['barcode','Barcode','barcodeItem','ean'])),
    name:text(pick(row,['desc','descp','name','description','namaBarang','nama_barang','productName'])) || `Item ${plu}`,
    qty,
  };
}
function rowCashier(row: Obj): string {
  return text(pick(row,['userId','user_id','nik','nikKasir','nik_kasir','cashierId','kasirNik','rowUserId']));
}
function aggregate(rows: Item[]): Item[] {
  const map = new Map<string,Item>();
  for (const x of rows) {
    const old = map.get(x.plu);
    if (!old) {map.set(x.plu,{...x});continue;}
    old.qty += x.qty;
    if (old.name.startsWith('Item ') && !x.name.startsWith('Item ')) old.name = x.name;
    if (!old.barcode) old.barcode = x.barcode;
  }
  return [...map.values()].sort((a,b)=>a.plu.localeCompare(b.plu,'id',{numeric:true}));
}
function numBon(v: unknown): number | null {
  const t=text(v);
  if (!/^\d{1,6}$/.test(t)) return null;
  const n=Number(t);
  return n>=1 && n<=MAX_BON ? n : null;
}
function analyzeReport(value: unknown, input: ReqInput): {items:Item[],bonNos:number[],bonCount:number|null, matchedRows:number, rowCount:number} {
  const rows=collectRows(value);
  const items:Item[]=[]; const bonNos=new Set<number>();
  let count:number|null=null, matchedRows=0;
  for (const row of rows) {
    const nik=rowCashier(row);
    if (nik && nik!==input.nik) continue;
    matchedRows++;
    const itm=itemFromRow(row);
    if (itm) items.push(itm);
    const bon=numBon(pick(row,['bill_no','billNo','noBon','no_bon','nomor_bon','billNumber']));
    if (bon) bonNos.add(bon);
    const n=numBon(pick(row,['jumlahBon','jumlah_bon','totalBon','total_bon','billCount','totalBills']));
    if (n && (count===null || n>count)) count=n;
  }
  // Support obj containing total summary field with no row list.
  if (obj(value)) {
    const n=numBon(pick(value,['jumlahBon','jumlah_bon','totalBon','total_bon','billCount','totalBills']));
    if (n && (count===null || n>count)) count=n;
  }
  return {items:aggregate(items),bonNos:[...bonNos].sort((a,b)=>a-b),bonCount:count,matchedRows,rowCount:rows.length};
}
async function discover(input: ReqInput): Promise<Obj> {
  const ddmmyyyy=input.dateTx.split('-').reverse().join('-');
  const diagnostics:SourceDiagnostic[]=[];
  const endpoints=[
    `rpt/laporan/laporan_penjualan_per_nomor_bon?${new URLSearchParams({storeId:input.storeId,userId:input.nik,periode1:ddmmyyyy,dateTx:input.dateTx})}`,
    `rpt/laporan/penjualan_per_kasir?${new URLSearchParams({storeId:input.storeId,userId:input.nik,periode1:ddmmyyyy})}`,
  ];
  for (const endpoint of endpoints) {
    const source=endpoint.split('?')[0];
    try {
      const value=await requestUpstream(input,endpoint,'GET');
      const found=analyzeReport(value,input);
      if (found.items.length>0) {
        return {success:true, mode:'items', source, items:found.items, billNumbers:[],
          completeness:'unverified', message:'Barang tersedia dari API laporan. Pastikan parameter NIK diterapkan server laporan.', diagnostics};
      }
      if (found.bonNos.length>0) {
        return {success:true, mode:'bills', source, billNumbers:found.bonNos, items:[],
          completeness:'unverified', message:`Ditemukan ${found.bonNos.length} nomor bon dari laporan. Detail akan diambil otomatis.`, diagnostics};
      }
      if (found.bonCount !== null) {
        const ids=Array.from({length:found.bonCount},(_,i)=>i+1);
        return {success:true,mode:'bills',source,billNumbers:ids,items:[],completeness:'unverified',
          message:`Laporan memberikan jumlah bon ${found.bonCount}, bukan daftar bon. Sistem memeriksa 1–${found.bonCount}; kelengkapan belum dapat dipastikan.`, diagnostics};
      }
      diagnostics.push({source,status:`JSON diterima, tetapi tidak ada PLU/Qty, nomor bon, atau total bon yang dapat diidentifikasi (${found.rowCount} baris).`});
    } catch(e) {
      diagnostics.push({source,status:e instanceof Error?e.message:'Gagal membaca laporan'});
    }
  }
  return {success:false,code:'BON_DISCOVERY_UNAVAILABLE',mode:'none', items:[],billNumbers:[],
    message:'Belum bisa mendapatkan SEMUA barang otomatis. Kedua API laporan tidak menyediakan daftar bon/PLU yang terbaca. APK THOR sendiri memerlukan bill_no sebelum mengambil item. Sistem tidak akan menampilkan 0 sebagai hasil penjualan lengkap.',diagnostics};
}
async function detail(input: ReqInput, body: Obj): Promise<Obj> {
  if (!Array.isArray(body.billNumbers)) throw new Error('Daftar nomor bon otomatis tidak tersedia.');
  const nums=body.billNumbers.map(numBon);
  if (!nums.length || nums.length>MAX_BATCH || nums.some(n=>n===null)) throw new Error(`Nomor bon otomatis harus 1–${MAX_BON}, maksimum ${MAX_BATCH} per batch.`);
  const bills=[...new Set(nums)] as number[];
  const items:Item[]=[]; const failures:{billNo:number,message:string}[]=[];
  let nonEmptyBills=0,successfulBills=0;
  let next=0;
  await Promise.all(Array.from({length:Math.min(6,bills.length)},async()=>{
    while(next<bills.length){
      const billNo=bills[next++];
      try {
        const value=await requestUpstream(input,'pos/transaksi/retur/get_transaction','POST',{
          storeId:input.storeId, dateTx:input.dateTx, userId:input.nik, billNo,
        });
        const rows=collectRows(value);
        const obtained=rows.map(itemFromRow).filter((r):r is Item=>r!==null);
        if (obtained.length) nonEmptyBills++;
        items.push(...obtained);
        successfulBills++;
      } catch(e){ failures.push({billNo,message:e instanceof Error?e.message:'Gagal mengambil bon'}); }
    }
  }));
  return {success:true,mode:'detail',checkedBills:bills.length,nonEmptyBills,successfulBills,
    failedBills:failures.sort((a,b)=>a.billNo-b.billNo),items:aggregate(items)};
}
async function lookup(input:ReqInput,body:Obj):Promise<Obj>{
  if (!Array.isArray(body.plus)) throw new Error('PLU wajib berupa array.');
  const plus=[...new Set(body.plus.map(text))];
  if (!plus.length || plus.length>8 || plus.some(p=>!/^[\w-]{1,20}$/.test(p))) throw new Error('Isi 1–8 PLU valid.');
  const results:{plu:string,name:string,barcode:string}[]=[]; const warnings:string[]=[];
  for(const plu of plus){
    try{
      const q=new URLSearchParams({storeId:input.storeId,searchValue:plu});
      const rows=collectRows(await requestUpstream(input,`sis/master/inventory/lov_items?${q}`,'GET'));
      const row=rows.find(r=>text(r.plu)===plu);
      if(row) results.push({plu,name:text(pick(row,['descp','desc','name'])),barcode:text(row.barcode)});
    } catch {warnings.push(`PLU ${plu} gagal dilengkapi`);}
  }
  return {success:true,results,warnings};
}
export async function OPTIONS(req:Request):Promise<Response>{
  const origin=req.headers.get('origin');
  return originAllowed(origin)?reply({success:true},200,origin):fail('Origin tidak diizinkan',403);
}
export async function GET(req:Request):Promise<Response>{
  const origin=req.headers.get('origin');
  if(!originAllowed(origin))return fail('Origin tidak diizinkan',403);
  return reply({success:true, service:'THOR Penjualan per NIK', version:'auto-discovery-v2',method:'POST',
    actions:['discover','detail','lookup'], note:'Tanpa login dan tanpa input bon awal/akhir. Kelengkapan tergantung laporan upstream.'},200,origin);
}
export async function POST(req:Request):Promise<Response>{
  const origin=req.headers.get('origin');
  if(!originAllowed(origin)) return fail('Origin tidak diizinkan',403);
  try{
    const bodyStr=await req.text();
    if(bodyStr.length>4000)return fail('Payload terlalu besar.',413,origin);
    let body:unknown;
    try{body=JSON.parse(bodyStr)}catch{return fail('Body JSON tidak valid.',400,origin)}
    if(!obj(body))return fail('Body JSON harus objek.',400,origin);
    const input=inputOf(body);
    let value:Obj;
    switch(body.action){
      case 'discover':value=await discover(input);break;
      case 'detail':value=await detail(input,body);break;
      case 'lookup':value=await lookup(input,body);break;
      default:return fail('Action harus discover, detail, atau lookup.',400,origin);
    }
    if(value.success===false)return reply(value,422,origin);
    return reply(value,200,origin);
  }catch(e){const message=e instanceof Error?e.message:'Gagal memproses request.';
    const status=/^(Kode toko|NIK|Tanggal|Branch ID|Daftar nomor|Nomor bon|PLU|Isi )/.test(message)?400:502;
    return fail(message,status,origin);
  }
}
