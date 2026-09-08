export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const URL_SAVE = 'https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item';
const reply = (body: unknown, status: number) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

// Preserve the submitted schema: the Alfastore write contract is not supplied.
export async function POST(request: Request) {
  let body;
  try { body = await request.json(); }
  catch { return reply({ success: false, message: 'Request bukan JSON yang valid.' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    return reply({ success: false, message: 'Body wajib berupa objek JSON yang tidak kosong.' }, 400);
  }
  // Store-Id follows the form body, without a fixed store fallback.
  const stores: string[] = [];
  for (const key of ['storeId', 'kodeToko']) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string') {
      return reply({ success: false, message: key + ' harus berupa teks kode toko.' }, 400);
    }
    const value = body[key].trim().toUpperCase();
    if (!/^[A-Z0-9]{1,30}$/.test(value)) {
      return reply({ success: false, message: 'Isi kode toko dengan huruf dan angka (maksimal 30 karakter).' }, 400);
    }
    stores.push(value);
  }
  if (!stores.length) {
    return reply({ success: false, message: 'Kode toko wajib diisi pada form (storeId atau kodeToko).' }, 400);
  }
  if (stores.some(value => value !== stores[0])) {
    return reply({ success: false, message: 'storeId dan kodeToko berbeda. Muat ulang barang sesuai form toko.' }, 400);
  }
  const store = stores[0];
  // Normalize only existing fields; leave all product fields and QTY intact.
  for (const key of ['storeId', 'kodeToko']) {
    if (body[key] !== undefined) body[key] = store;
  }
  const apiKey = process.env.ALFA_API_KEY || process.env.ALFASTORE_API_KEY;
  if (!apiKey) return reply({ success: false, message: 'ALFA_API_KEY belum diatur di server.' }, 500);
  const headers: Record<string, string> = {
    'App-Name': 'SO-PDA',
    'Version-App': process.env.ALFASTORE_VERSION_APP || 'V.2026.04.13.01-alfa',
    'Version-Code': process.env.ALFASTORE_VERSION_CODE || '28',
    Platform: 'ANDROID',
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)',
    'Api-Key': apiKey,
    'User-Id': process.env.ALFASTORE_USER_ID || '23067884',
    'Store-Id': store,
    'Branch-Id': process.env.ALFA_BRANCH_ID || process.env.ALFASTORE_BRANCH_ID || 'MZ01',
    AndroidId: process.env.ALFASTORE_ANDROID_ID || '56cb5d6cc7274364',
    'Mac-Addr': process.env.ALFASTORE_MAC_ADDR || '56cb5d6cc7274364',
    'Content-Type': 'application/json', Accept: 'application/json',
  };
  const appUid = process.env.ALFA_APP_UID || process.env.ALFASTORE_APP_UID;
  if (appUid) headers['App-Uid'] = appUid;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    // Exactly one POST. A timeout does not prove that no data was written.
    const response = await fetch(URL_SAVE, {
      method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store',
      redirect: 'manual', signal: controller.signal,
    });
    const raw = await response.text();
    let data: unknown = raw || null;
    try { data = JSON.parse(raw); } catch { /* Keep original upstream text. */ }
    const envelopes: Record<string, unknown>[] = [];
    function visit(value: unknown, depth = 0) {
      if (depth > 8) return;
      if (typeof value === 'string') {
        try { visit(JSON.parse(value), depth + 1); } catch { /* Plain text. */ }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        envelopes.push(obj);
        for (const key of ['data', 'response', 'error']) visit(obj[key], depth + 1);
      }
    }
    visit(data);
    const failed = envelopes.some(v => v.success === false || v.status === false ||
      ['error', 'failed', 'failure'].includes(String(v.status).toLowerCase()) ||
      (Number(v.status) >= 400 && Number(v.status) <= 599));
    const messages = envelopes.flatMap(v => ['message', 'msg', 'pesan', 'error_description', 'error'].map(k => v[k]))
      .filter((v): v is string => typeof v === 'string' && !!v.trim());
    const success = response.ok && !failed;
    return reply({
      success, status: response.status,
      message: [...new Set(messages)].join('\n') || (success
        ? 'Respons diterima. Periksa QTY melalui pembacaan ulang.'
        : 'Alfastore menolak permintaan. Lihat respons asli pada data.'),
      data,
    }, response.status >= 300 && response.status < 400 ? 502
      : [204, 205, 304].includes(response.status) ? 200 : response.status);
  } catch {
    return reply({ success: false,
      message: controller.signal.aborted
        ? 'Waktu tunggu Alfastore habis. Status simpan belum diketahui; muat ulang QTY sebelum mencoba lagi.'
        : 'Koneksi ke Alfastore gagal. Status simpan belum diketahui; muat ulang QTY sebelum mencoba lagi.',
    }, controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}
