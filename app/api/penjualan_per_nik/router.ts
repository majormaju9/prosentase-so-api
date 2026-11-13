// Next.js App Router. Set PENJUALAN_NIK_PASSWORD on the server.
// Browser username: admin.
// Optional: ALFASTORE_URL, ALFASTORE_BRANCH_ID, ALFASTORE_STORE_ID.
import { createHash, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALFASTORE_API_KEY = 'iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG';
const ALFASTORE_USER_ID = '20020884';

const noCache = { 'Cache-Control': 'private, no-store' };

type Item = { plu: string; namaBarang: string; barcode: string; qty: number };

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: noCache });
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function jakartaTime() {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  return parts;
}

function parseUpstream(body: string): unknown {
  return JSON.parse(body.trim().replace(/^200\^\s*/, ''));
}

export async function GET(request: Request) {
  const password = process.env.PENJUALAN_NIK_PASSWORD;
  const allowedStore = (process.env.ALFASTORE_STORE_ID || 'M604').toUpperCase();
  if (!password) {
    return json({ error: 'Konfigurasi akses server belum lengkap.' }, 503);
  }

  const credentials = request.headers.get('authorization') || '';
  const expected = 'Basic ' + Buffer.from('admin:' + password).toString('base64');
  if (!timingSafeEqual(digest(credentials), digest(expected))) {
    return new Response('Masuk untuk membuka rekap penjualan.', {
      status: 401,
      headers: { ...noCache, 'WWW-Authenticate': 'Basic realm="Penjualan per NIK"' },
    });
  }

  const params = new URL(request.url).searchParams;
  const nik = (params.get('nik') || params.get('userId') || '').trim();
  const storeId = (params.get('storeId') || allowedStore).trim().toUpperCase();
  const now = jakartaTime();
  const today = now.slice(0, 10);
  const dateTx = params.get('dateTx') || today;
  const parsed = new Date(dateTx + 'T00:00:00Z');

  if (!/^\d{1,32}$/.test(nik)) {
    return json({ error: 'Isi parameter nik dengan NIK kasir.' }, 400);
  }
  if (storeId !== allowedStore) {
    return json({ error: 'Kode toko tidak diizinkan.' }, 403);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTx) || Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dateTx || dateTx > today) {
    return json({ error: 'Isi dateTx dengan tanggal yang valid (YYYY-MM-DD).' }, 400);
  }

  try {
    const base = (process.env.ALFASTORE_URL || 'https://app.alfastore.co.id/prd/api')
      .replace(/\/+$/, '') + '/';
    const headers = new Headers({
      'Api-Key': ALFASTORE_API_KEY,
      'Store-Id': storeId,
      'User-Id': ALFASTORE_USER_ID,
      Platform: 'ANDROID',
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'python-requests/2.28.2',
    });
    const branch = process.env.ALFASTORE_BRANCH_ID;
    if (branch) headers.set('Branch-Id', branch);
    const deadline = AbortSignal.timeout(50_000);

    const loginUrl = new URL('so/login/cek_login', base);
    loginUrl.search = new URLSearchParams({
      storeId, nik, clientDate: dateTx === today ? now : dateTx + ' 23:59:59',
      version_app: 'V.2021.1.1',
    }).toString();
    const login = await fetch(loginUrl, {
      headers: new Headers([...headers.entries(), ['App-Name', 'SO']]),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(12_000)]),
    });
    if (!login.ok) {
      return json({ error: 'API informasi kasir gagal.', upstreamStatus: login.status }, 502);
    }

    const payload = parseUpstream(await login.text()) as {
      dataUser?: { bill_no?: number | string; name?: string; nick_name?: string };
    } | null;
    const user = payload?.dataUser;
    if (!user) return json({ error: 'Informasi kasir tidak ditemukan pada respons API.' }, 502);
    const lastBill = Number(user.bill_no);
    if (!Number.isSafeInteger(lastBill) || lastBill < 0 ||
        user.bill_no == null || user.bill_no === '') {
      return json({ error: 'API tidak mengembalikan nomor bon yang valid.' }, 502);
    }

    // Rentang pencarian bon mengikuti THOR v15.1.1.
    const anchor = lastBill || 250;
    let nextBill = Math.max(1, anchor - 350);
    const endBill = anchor + 20;
    const transactionUrl = new URL('pos/transaksi/retur/get_transaction', base);
    headers.set('App-Name', 'InventoryIntelligence');
    const items = new Map<string, Item>();
    let totalBon = 0;
    let gagalBon = 0;
    let statusGagal: number | undefined;

    async function worker() {
      while (!deadline.aborted && nextBill <= endBill) {
        const billNo = nextBill++;
        try {
          const response = await fetch(transactionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ storeId, dateTx, userId: nik, billNo }),
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.any([deadline, AbortSignal.timeout(8_000)]),
          });
          if (response.status === 204) continue;
          if (!response.ok) {
            statusGagal ??= response.status;
            gagalBon++;
            continue;
          }

          const rows = parseUpstream(await response.text());
          if (!Array.isArray(rows)) throw new Error('Format detail bon tidak valid');
          if (rows.length > 0) totalBon++;
          for (const row of rows) {
            const plu = String(row?.plu ?? '');
            const qty = Number(row?.qty);
            if (!/^\d+$/.test(plu) || Number(plu) < 1 || !Number.isFinite(qty)) continue;
            const namaBarang = typeof row.desc === 'string' ? row.desc : '';
            const barcode = String(row.barcode ?? '');
            const item = items.get(plu);
            if (item) {
              item.qty += qty;
              item.namaBarang ||= namaBarang;
              item.barcode ||= barcode;
            } else {
              items.set(plu, { plu, namaBarang, barcode, qty });
            }
          }
        } catch {
          gagalBon++;
        }
      }
    }

    await Promise.all(Array.from({ length: 12 }, worker));
    const belumDicek = Math.max(0, endBill - nextBill + 1);
    const jumlahBelumBerhasil = gagalBon + belumDicek;
    const lengkap = jumlahBelumBerhasil === 0;
    return json({
      storeId, nik, dateTx,
      namaKasir: user.name || user.nick_name || '',
      totalBon,
      lengkap,
      gagalBon,
      belumDicek,
      ...(statusGagal ? { upstreamStatus: statusGagal } : {}),
      barang: [...items.values()].sort((a, b) => b.qty - a.qty || a.plu.localeCompare(b.plu)),
    }, lengkap ? 200 : deadline.aborted ? 504 : 502);
  } catch (error) {
    const timeout = error instanceof Error && /^(TimeoutError|AbortError)$/.test(error.name);
    return json({ error: timeout ? 'Waktu tunggu API habis.' : 'Gagal membaca API Alfastore.' },
      timeout ? 504 : 502);
  }
}
