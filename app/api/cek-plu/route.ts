export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;
const base = 'https://app.alfastore.co.id/prd/api/';
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function records(value: unknown): Row[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(records);
  const obj = value as Row;
  return [obj, ...Object.values(obj).flatMap(records)];
}

function field(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const entry = Object.entries(row).find(([k]) => k.toLowerCase() === key.toLowerCase());
    const v = entry?.[1];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('kode')?.trim() || '';
  if (!/^\d{1,32}$/.test(code)) return reply({ error: 'Masukkan PLU atau barcode berupa angka.' }, 400);
  const storeId = process.env.SIS_STORE_ID || 'M865';
  const apiKey = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
  const userId = '20020884';

  // Identitas toko dan pengguna berasal dari konfigurasi server.
  const headers = {
    'Content-Type': 'application/json', Accept: 'application/json',
    'User-Agent': 'python-requests/2.28.2', 'Api-Key': apiKey,
    'App-Name': 'InventoryIntelligence', Platform: 'ANDROID',
    'Store-Id': storeId, 'User-Id': userId,
    'Branch-Id': process.env.SIS_BRANCH_ID || 'MZ01', 'Accept-Encoding': 'gzip'
  };
  async function read(path: string, params: Record<string, string>) {
    const url = new URL(path, base);
    url.search = new URLSearchParams(params).toString();
    const options = { headers, cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10000) } as const;
    let res = await fetch(url, options);
    if ([301, 302, 307, 308].includes(res.status)) {
      const location = res.headers.get('Location');
      if (location) {
        const next = new URL(location, url);
        if (next.origin === url.origin && next.pathname.replace(/\/$/, '') === url.pathname.replace(/\/$/, '')) {
          if (!next.search) next.search = url.search;
          res = await fetch(next, options);
        }
      }
    }
    if (!res.ok) throw new Error('Alfastore mengembalikan HTTP ' + res.status + '.');
    try { return await res.json(); }
    catch { throw new Error('Respons Alfastore bukan JSON.'); }
  }
  try {
    const data = await read('sis/master/inventory/lov_items', { storeId, searchValue: code });
    const item = records(data).find(r =>
      [field(r,'plu'),field(r,'barcode')].includes(code) && field(r,'descp','nama_barang','description','nama'));
    if (!item) return reply({ error: 'Nama barang dengan PLU atau barcode persis ini tidak ditemukan di master barang.' }, 404);
    const plu = field(item,'plu');
    const product = { nama: field(item,'descp','nama_barang','description','nama'), plu, barcode: field(item,'barcode'), storeId };
    let tahap = 'Pemeriksaan PLU / barcode';
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date());
      const params = { storeId, storeDate: parts.replaceAll('/','-'), inputType:'ITEM' };
      const check = await read('laporan/label_price/check_input_filter', { ...params, inputFilter: code });
      const options = records(check).find(r => Array.isArray(r.planograms))?.planograms;
      // Dialog SISA mengirim nilai kolom planogram dari baris pilihan.
      const planos = Array.isArray(options) ? [...new Set(options.map((option: unknown) => {
        if (typeof option === 'string' || typeof option === 'number') return String(option).trim();
        return option && typeof option === 'object' ? field(option as Row, 'planogram') : '';
      }).filter(Boolean))] : [];
      tahap = 'Pengambilan Label Price Besar';
      const details = await read('laporan/label_price/', { ...params, priceType:'BESAR', inputFilter: JSON.stringify({ plu: code, planograms: planos }) });
      const labels = records(details).filter(r => (plu && field(r,'plu') === plu || field(r,'barcode') === code) && Object.keys(r).some(k => /^(price|harga|planogram|fprice|f_price)$/i.test(k))).map(r => ({
        Planogram: field(r,'planogram'), Subdept: field(r,'subdept'), Harga: field(r,'price','harga'),
        F_Price: field(r,'fPrice','F_Price'), Barcode: field(r,'barcode'), D_B_FP: field(r,'dbfp','D_B_FP'), D_E_FP: field(r,'defp','D_E_FP')
      }));
      return reply({ product, labels, note: labels.length ? '' : 'Detail Label Price belum tersedia.' });
    } catch (err) {
      let cause = 'Koneksi ke server Alfastore gagal.';
      if (err instanceof Error) {
        if (/^(Alfastore mengembalikan HTTP \d{3}\.|Respons Alfastore bukan JSON\.)$/.test(err.message)) cause = err.message;
        if (err.name === 'TimeoutError' || err.name === 'AbortError') cause = 'Alfastore belum merespons dalam 10 detik.';
      }
      return reply({ product, labels: [], note: tahap + ' gagal. ' + cause });
    }
  } catch (err) {
    const message = err instanceof Error && err.message.startsWith('Alfastore mengembalikan HTTP') ? err.message :
      err instanceof Error && err.message === 'Respons Alfastore bukan JSON.' ? err.message : 'Koneksi ke Alfastore gagal atau melewati batas waktu.';
    return reply({ error: message }, 502);
  }
}
