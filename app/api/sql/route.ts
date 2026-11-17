/**
 * Vercel Next.js App Router: app/api/sql/route.ts
 * Rekap per NIK langsung + pencarian data PLU otomatis, TANPA input nomor bon.
 * Hanya membaca data yang benar-benar disediakan upstream. Tidak membuat PLU/Qty fiktif.
 * ALFA_API_KEY diset di Vercel Environment Variables (jangan di frontend/repository).
 * Source rekap yang terbukti: /prd/api/rpt/laporan/penjualan_per_kasir
 * Kandidat laporan detail dari APK THOR: /prd/api/rpt/laporan/laporan_penjualan_per_nomor_bon
 * Belum terverifikasi bahwa kandidat tersebut berisi PLU untuk seluruh transaksi.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VERSION = '2026-11-18-otomatis-tanpa-nomor-bon-v1';
const BASE = 'https://app.alfastore.co.id/prd/api/';
const KASIR_PATH = 'rpt/laporan/penjualan_per_kasir';
const PLU_REPORT_PATH = 'rpt/laporan/laporan_penjualan_per_nomor_bon';
const MAX_TEXT = 1_500_000;

type Kasir = {
  nik: string; nama: string; jumlahBon: number; transaksi: number;
  qty: number; return: number; void: number; diskonHemat: number;
  netLP: number; bagiHasil: number; totalPrice: number;
};
type Item = { plu: string; barcode: string; nama: string; qty: number };
type Ctx = { storeId: string; nik: string; dateTx: string; branchId: string; periode1: string };

function json(data: object, status = 200): Response {
  return Response.json(data, {status,headers:{'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d;
}
function todayWib(): string {
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(k:string)=>p.find(x=>x.type===k)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function decodeHtml(raw: string):string {
  const named:Record<string,string>={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ndash:'–',mdash:'—'};
  return raw.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,(m,entity:string)=>{
    if (entity.startsWith('#')) {
      const hex=entity[1]?.toLowerCase()==='x'; const n=Number.parseInt(entity.slice(hex?2:1),hex?16:10);
      return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):m;
    }
    return named[entity.toLowerCase()]??m;
  });
}
function plain(html:string):string {
  return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ')).replace(/[\s\u00a0]+/g,' ').trim();
}
function toInt(input:string):number|null {
  let s=input.replace(/[\s\u00a0]/g,'').replace(/[^\d.,-]/g,'');
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(s)) s=s.replace(/[.,]/g,'');
  if (!/^-?\d+$/.test(s)) return null;
  const n=Number(s);return Number.isSafeInteger(n)?n:null;
}
function qtyNumber(value:unknown):number|null {
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  const s=value.trim().replace(/\s/g,'');
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  if (/^-?\d{1,3}(?:[.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g,''));
  return null;
}
function trCells(row:string):string[]{
  return [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map(m=>plain(m[1]));
}
function reportRows(html:string):Kasir[]{
  const table=html.match(/<table\b[^>]*class\s*=\s*["'][^"']*\bdatatable\b[^"']*["'][^>]*>[\s\S]*?<\/table\s*>/i)?.[0]||html;
  const body=table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody\s*>/i)?.[1]||table;
  const result:Kasir[]=[];
  for(const row of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const c=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(x=>plain(x[1]));
    if(c.length!==11)continue;
    const nik=c[0].replace(/\s/g,''); if(!/^\d{4,12}$/.test(nik))continue;
    const n=c.slice(2).map(toInt); if(n.some(x=>x===null))continue;
    result.push({nik,nama:c[1],jumlahBon:n[0]!,transaksi:n[1]!,qty:n[2]!,return:n[3]!,void:n[4]!,diskonHemat:n[5]!,netLP:n[6]!,bagiHasil:n[7]!,totalPrice:n[8]!});
  }
  return result;
}
function isErrorHtml(html:string):string|null {
  const t=plain(html).slice(0,350);
  if(/report ditolak|belum melakukan eod/i.test(t))return 'Laporan ditolak oleh Alfastore: toko belum melakukan EOD.';
  if(/(?:404 Not Found|403 Forbidden|400 Bad Request|500 Internal Server Error)/i.test(t)&&/<html|<!doctype/i.test(html))return 'Alfastore mengembalikan halaman error: '+t.slice(0,150);
  return null;
}
function upstreamHeaders(ctx:Ctx):HeadersInit {
  return {
    Accept:'text/html, application/json, */*',
    'Content-Type':'application/json',
    'Api-Key':process.env.ALFA_API_KEY||'',
    'App-Name':process.env.ALFA_APP_NAME||'InventoryIntelligence',
    Platform:process.env.ALFA_PLATFORM||'ANDROID',
    'Store-Id':ctx.storeId,
    'User-Id':process.env.ALFA_USER_ID||ctx.nik,
    'Branch-Id':ctx.branchId,
    'User-Agent':process.env.ALFA_USER_AGENT||'python-requests/2.28.2',
  };
}
async function upstreamGet(path:string,query:Record<string,string>,ctx:Ctx):Promise<{status:number;ok:boolean;raw:string;contentType:string}> {
  const url=new URL(path,BASE);url.search=new URLSearchParams(query).toString();
  const r=await fetch(url,{method:'GET',headers:upstreamHeaders(ctx),redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000)});
  const raw=(await r.text()).slice(0,MAX_TEXT);
  return {status:r.status,ok:r.ok&&r.status<300,raw,contentType:r.headers.get('content-type')||''};
}
function indexForHeader(headers:string[],names:string[]):number {
  return headers.findIndex(h=>names.some(n=>h.toLowerCase().replace(/[^a-z0-9]/g,'').includes(n)));
}
/** Strict parser: PLU and Qty must be explicit, and NIK must be verifiably attributable. */
function parsePluHtml(html:string,nik:string):Item[] {
  const output:Item[]=[];
  for(const tbl of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)){
    const rows=[...tbl[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(x=>trCells(x[1]));
    if(rows.length<2)continue;
    const heading=rows.findIndex(c=>c.some(x=>/^PLU$|^Kode\s*(?:PLU|Barang)$/i.test(x)) && c.some(x=>/^(?:Qty|Kuantitas|Jumlah\s*Item)$/i.test(x)));
    if(heading<0)continue;
    const headers=rows[heading];
    const pluCol=headers.findIndex(x=>/^PLU$|^Kode\s*(?:PLU|Barang)$/i.test(x));
    const qtyCol=headers.findIndex(x=>/^(?:Qty|Kuantitas|Jumlah\s*Item)$/i.test(x));
    const nikCol=headers.findIndex(x=>/^(?:NIK|User\s*ID|NIK\s*Kasir)$/i.test(x));
    const barcodeCol=headers.findIndex(x=>/^Barcode$/i.test(x));
    const namaCol=headers.findIndex(x=>/^(?:Nama\s*Barang|Deskripsi|Nama\s*Item|Descp)$/i.test(x));
    // Jika tabel tidak memuat kolom NIK, wajib ada label NIK eksplisit di bagian header laporan.
    const contextNik=new RegExp('(?:NIK(?:\\s+Kasir)?|User\\s*ID)\\s*[:：]\\s*'+nik+'(?:\\D|$)','i').test(plain(html).slice(0,1500));
    if(nikCol<0&&!contextNik)continue;
    for(const row of rows.slice(heading+1)){
      if(row.length<=Math.max(pluCol,qtyCol,nikCol))continue;
      if(nikCol>=0&&row[nikCol].replace(/\s/g,'')!==nik)continue;
      const plu=row[pluCol]?.replace(/\s/g,'')||'';
      const qty=qtyNumber(row[qtyCol]);
      if(!/^\d{3,16}$/.test(plu)||qty===null)continue;
      output.push({plu,qty,barcode:barcodeCol>=0?row[barcodeCol]||'':'',nama:namaCol>=0?row[namaCol]||'':''});
    }
  }
  return output;
}
/** JSON response can be used only when each item explicitly identifies the requested NIK. */
function parsePluJson(raw:string,nik:string):Item[]{
  let root:unknown;
  try{root=JSON.parse(raw);}catch{return [];}
  const result:Item[]=[];
  function visit(node:unknown,depth:number):void {
    if(depth>5||!node||typeof node!=='object')return;
    if(Array.isArray(node)){for(const child of node.slice(0,10000))visit(child,depth+1);return;}
    const o=node as Record<string,unknown>;
    const plu=String(o.plu??o.PLU??o.plu_code??'').trim();
    const rowNik=String(o.nik??o.userId??o.user_id??'').trim();
    const qty=qtyNumber(o.qty??o.QTY??o.quantity);
    if(/^\d{3,16}$/.test(plu)&&rowNik===nik&&qty!==null) {
      result.push({plu,qty,barcode:String(o.barcode??''),nama:String(o.namaBarang??o.descp??o.nama??'')});
      return;
    }
    for(const key of ['data','items','rows','result','list','details','transactions']) if(o[key]) visit(o[key],depth+1);
  }
  visit(root,0);return result;
}
function aggregate(rows:Item[]):Item[]{
  const map=new Map<string,Item>();
  for(const row of rows){const p=map.get(row.plu);if(p){p.qty=Number((p.qty+row.qty).toFixed(3));if(!p.nama)p.nama=row.nama;if(!p.barcode)p.barcode=row.barcode;}else map.set(row.plu,{...row});}
  return [...map.values()].sort((a,b)=>a.plu.localeCompare(b.plu,'en',{numeric:true}));
}
async function autoPlu(ctx:Ctx):Promise<{items:Item[];source:string;note:string;diagnostic:string}> {
  // Satu permintaan ke laporan kandidat APK; tanpa perulangan/tebak nomor bon.
  // Parameter userId + periode1 adalah kandidat; bukan jaminan filter server.
  try{
    const r=await upstreamGet(PLU_REPORT_PATH,{storeId:ctx.storeId,userId:ctx.nik,periode1:ctx.periode1},ctx);
    const error=isErrorHtml(r.raw);
    if(!r.ok||error)return {items:[],source:`/prd/api/${PLU_REPORT_PATH}`,note:'Sumber detail PLU belum dapat digunakan.',diagnostic:error||`HTTP ${r.status} dari laporan kandidat.`};
    const rows=/^\s*[{[]/.test(r.raw)?parsePluJson(r.raw,ctx.nik):parsePluHtml(r.raw,ctx.nik);
    const items=aggregate(rows);
    if(!items.length)return {items:[],source:`/prd/api/${PLU_REPORT_PATH}`,note:'Laporan kandidat tidak menyediakan PLU + QTY yang dapat dikaitkan secara pasti dengan NIK. Rekap kasir tidak berisi kode PLU.',diagnostic:`HTTP ${r.status}; format=${/^\s*[{[]/.test(r.raw)?'json':'html'}; PLU valid=0`};
    return {items,source:`/prd/api/${PLU_REPORT_PATH}`,note:'Daftar diambil dari baris detail dengan NIK dan kolom PLU/QTY eksplisit. Kelengkapan semua transaksi belum terverifikasi.',diagnostic:`HTTP ${r.status}; baris PLU terbaca=${rows.length}`};
  }catch(e){return {items:[],source:`/prd/api/${PLU_REPORT_PATH}`,note:'Sumber detail PLU belum dapat diakses.',diagnostic:(e instanceof Error?e.message:String(e)).slice(0,160)};}
}
async function handler(request:Request):Promise<Response>{
  const p=new URL(request.url).searchParams;
  const mode=(p.get('mode')||'auto').toLowerCase();
  const keyConfigured=Boolean(process.env.ALFA_API_KEY);
  if(mode==='health'||(!p.has('storeId')&&!p.has('nik'))){return json({ok:true,status:'route-ready',version:VERSION,path:'/api/sql',apiKeyConfigured:keyConfigured,loginRequired:false,modes:['auto','report','health'],note:'Mode auto membaca rekap kasir dan mencoba 1 laporan detail APK, tanpa nomor bon. Daftar PLU hanya ditampilkan jika sumber memuat baris PLU + Qty dan NIK yang dapat diverifikasi.',example:'/api/sql?storeId=M865&nik=20020884&dateTx=2026-11-17&branchId=MZ01'});}
  if(!['auto','report'].includes(mode))return json({ok:false,code:'MODE_INVALID',message:'Gunakan mode=auto, report, atau health. Mode scan nomor bon telah dihapus.'},400);
  const storeId=(p.get('storeId')||'').toUpperCase().trim();
  const nik=(p.get('nik')||p.get('userId')||'').trim();
  const dateTx=(p.get('dateTx')||todayWib()).trim();
  const branchId=(p.get('branchId')||process.env.ALFA_BRANCH_ID||'MZ01').trim().toUpperCase();
  if(!/^[A-Z0-9]{4,8}$/.test(storeId)||!/^\d{4,12}$/.test(nik)||!validDate(dateTx)||!/^[A-Z0-9_-]{2,12}$/.test(branchId))return json({ok:false,code:'INVALID_PARAMETERS',message:'Pastikan storeId, nik, dateTx (yyyy-MM-dd), dan branchId valid.'},400);
  if(!keyConfigured)return json({ok:false,code:'MISSING_API_KEY',message:'Set ALFA_API_KEY di Environment Variables Vercel.'},503);
  const ctx:Ctx={storeId,nik,dateTx,branchId,periode1:dateTx.split('-').reverse().join('-')};
  try{
    const report=await upstreamGet(KASIR_PATH,{storeId,userId:nik,periode1:ctx.periode1},ctx);
    const error=isErrorHtml(report.raw);
    if(!report.ok||error)return json({ok:false,code:error?.includes('EOD')?'EOD_REQUIRED':'UPSTREAM_ERROR',message:error||`Alfastore menolak laporan (HTTP ${report.status}).`,upstreamStatus:report.status,endpoint:`/prd/api/${KASIR_PATH}`},error?.includes('EOD')?409:502);
    if(!/<(?:!doctype\s+html|html\b|table\b)/i.test(report.raw))return json({ok:false,code:'REPORT_FORMAT_INVALID',message:'Laporan kasir bukan tabel HTML.'},502);
    const rows=reportRows(report.raw);
    if(!rows.length)return json({ok:false,code:'REPORT_TABLE_NOT_FOUND',message:'Tabel rekap kasir 11 kolom tidak ditemukan.'},502);
    const kasir=rows.find(x=>x.nik===nik);
    if(!kasir)return json({ok:false,code:'NIK_NOT_FOUND',message:`NIK ${nik} tidak tercatat pada laporan ${dateTx} di toko ${storeId}.`},404);
    const detail=mode==='auto'?await autoPlu(ctx):{items:[] as Item[],source:'',note:'Mode report hanya membaca rekap kasir.',diagnostic:''};
    const totalQtyDetail=detail.items.length?Number(detail.items.reduce((v,x)=>v+x.qty,0).toFixed(3)):null;
    return json({ok:true,status:'success',version:VERSION,source:'Alfastore',mode:mode==='auto'?'auto':'report-html',
      storeId,nik,dateTx,branchId,periode1:ctx.periode1,upstreamStatus:report.status,endpoint:`/prd/api/${KASIR_PATH}`,
      qtyAvailable:true,qtyScope:'kasir',totalQty:kasir.qty,totalBon:kasir.jumlahBon,totalTrs:kasir.transaksi,totalPenjualan:kasir.totalPrice,kasir,
      pluAvailable:detail.items.length>0,pluComplete:false,pluStatus:detail.items.length?'found-unverified-completeness':'not-available',
      totalPLU:detail.items.length?detail.items.length:null,totalQtyDetail,items:detail.items,pluSource:detail.source,pluNote:detail.note,
      diagnostic:detail.diagnostic,
      message:detail.items.length?'Rekap berhasil; PLU ditemukan tetapi kelengkapan perlu verifikasi.':'Rekap berhasil; PLU per barang tidak tersedia dari sumber yang berhasil divalidasi.',
      note:'QTY rekap kasir tidak mengandung kode PLU. PLU tidak dapat direkonstruksi dari angka total.',
    });
  }catch(e){const message=e instanceof Error?e.message:String(e);const timeout=/abort|timeout/i.test(message);return json({ok:false,code:timeout?'UPSTREAM_TIMEOUT':'UPSTREAM_CONNECTION_ERROR',message:timeout?'Alfastore tidak menjawab dalam batas waktu.':'Koneksi ke Alfastore gagal.',diagnostic:message.slice(0,150)},502);}
}
function corsHeaders(request:Request):Headers{
  const h=new Headers(),origin=request.headers.get('origin')||'';
  if(['https://alfastore.my.id','https://www.alfastore.my.id','https://majormaju9-prosentase-so-api.vercel.app'].includes(origin)||/^http:\/\/localhost(?::\d+)?$/.test(origin)){
    h.set('Access-Control-Allow-Origin',origin);h.set('Access-Control-Allow-Methods','GET, OPTIONS');h.set('Access-Control-Allow-Headers','Accept, Content-Type');h.set('Access-Control-Max-Age','3600');
  }
  h.set('Vary','Origin');return h;
}
export async function OPTIONS(request:Request):Promise<Response>{return new Response(null,{status:204,headers:corsHeaders(request)});}
export async function GET(request:Request):Promise<Response>{
  try{const r=await handler(request);corsHeaders(request).forEach((v,k)=>r.headers.set(k,v));return r;}
  catch{return json({ok:false,code:'INTERNAL_ERROR',message:'Kesalahan internal saat mengambil laporan.'},500);}
}
