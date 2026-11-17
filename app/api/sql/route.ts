/**
 * app/api/penjualan_per_nik/route.ts
 * Penjualan per NIK — parser laporan HTML Alfastore yang memuat QTY per kasir.
 * Tidak melakukan cek_login atau memanggil endpoint login.
 *
 * Upstream: GET /prd/api/rpt/laporan/penjualan_per_kasir
 * Query upstream: storeId, userId, periode1 (dd-MM-yyyy)
 * API key hanya berasal dari variabel lingkungan server ALFA_API_KEY.
 *
 * PERHATIAN: file ini menggantikan /api/penjualan_per_nik jika route itu sudah ada.
 * Simpan salinan route /api/sql lama sebelum mengganti karena mungkin dipakai fitur lain.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const VERSION = '2026-11-18-html-kasir-qty-v2';
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

export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams;
  const storeId = (p.get('storeId') ?? '').trim().toUpperCase();
  const nik = (p.get('nik') ?? p.get('userId') ?? '').trim();
  const dateTx = (p.get('dateTx') ?? wibToday()).trim();
  const branchId = (p.get('branchId') ?? process.env.ALFA_BRANCH_ID ?? 'MZ01').trim().toUpperCase();
  const apiKey = process.env.ALFA_API_KEY ?? '';

  if ((!storeId && !nik) || p.get('mode') === 'health') {
    return sendJson({
      ok: true, status: 'route-ready', version: VERSION, path: '/api/penjualan_per_nik',
      apiKeyConfigured: Boolean(apiKey), loginRequired: false,
      upstreamEndpoint: `/prd/api/${REPORT_PATH}`,
      responseType: 'rekap-kasir', qtyScope: 'per-kasir',
      message: 'Route aktif. Masukkan storeId, nik, dateTx untuk membaca QTY pada baris NIK dalam laporan HTML.',
      example: '/api/penjualan_per_nik?storeId=M865&nik=20020884&dateTx=2026-11-17&branchId=MZ01',
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
