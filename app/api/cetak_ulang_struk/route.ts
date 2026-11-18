/**
 * app/api/cetak_ulang_struk/route.ts (Vercel Next.js App Router)
 * Pencarian seluruh PLU berdasarkan storeId + userId (NIK) + dateTx.
 * Endpoint get_transaction lama TIDAK digunakan, karena membutuhkan billNo.
 * Tidak membuat nomor bon atau data transaksi fiktif.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ALFA_BASE = "https://app.alfastore.co.id";
const API_KEY = process.env.ALFA_API_KEY?.trim() || "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";
const LOGIN_USER = process.env.ALFA_USER_ID?.trim() || "20020884";
const BRANCH_ID = process.env.ALFA_BRANCH_ID?.trim() || "MZ01";
const MAX_ROWS = 5000;

type Dict = Record<string, unknown>;
type ReportInfo = { name: string; path: string; params: Record<string, string> };
type Detail = {
  plu: string;
  name: string | null;
  qty: unknown;
  price: unknown;
  total: unknown;
};

function respond(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" },
  });
}
function dict(v: unknown): Dict | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Dict : null;
}
function norm(k: string) { return k.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function get(obj: Dict | null, names: string[]): unknown {
  if (!obj) return undefined;
  for (const name of names) {
    const found = Object.keys(obj).find(key => norm(key) === norm(name));
    if (found && obj[found] !== undefined && obj[found] !== null && obj[found] !== "") return obj[found];
  }
  return undefined;
}
function str(v: unknown): string {
  return v === undefined || v === null || typeof v === "object" ? "" : String(v).trim();
}
function validDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const date = new Date(`${d}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === d;
}
function dayString(d: string): string {
  const [year, month, day] = d.split("-");
  return `${day}-${month}-${year}`;
}
function normalizeDate(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const t = str(v);
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t);
  if (local) return `${local[3]}-${local[2]}-${local[1]}`;
  return null;
}

// Laporan ini dapat mengembalikan PLU tanpa perlu mengetahui nomor bon.
function reports(storeId: string, userId: string, dateTx: string): ReportInfo[] {
  return [
    {
      name: "penjualan_per_nik",
      path: "/prd/api/rpt/laporan/penjualan_per_nik",
      params: { storeId, nik: userId, dateTx },
    },
    {
      name: "penjualan_per_kasir",
      path: "/prd/api/rpt/laporan/penjualan_per_kasir",
      params: { storeId, userId, periode1: dayString(dateTx) },
    },
  ];
}

type ReportResult = { success: true; data: unknown } | { success: false; message: string; status: number | null };
async function fetchReport(report: ReportInfo, storeId: string, page?: number): Promise<ReportResult> {
  const url = new URL(report.path, ALFA_BASE);
  for (const [name, value] of Object.entries(report.params)) url.searchParams.set(name, value);
  if (page && page > 1) url.searchParams.set("page", String(page));
  const headers: Record<string, string> = {
    Accept: "application/json,text/plain,*/*",
    "User-Agent": "python-requests/2.28.2",
    "Api-Key": API_KEY,
    "App-Name": "InventoryIntelligence",
    Platform: "ANDROID",
    "Store-Id": storeId,
    "User-Id": LOGIN_USER,
    "Branch-Id": BRANCH_ID,
  };
  let response: Response;
  let raw: string;
  try {
    response = await fetch(url, {
      method: "GET", headers, cache: "no-store", redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    raw = (await response.text()).trim();
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { success: false, message: timeout ? "Timeout API Alfastore" : "Gagal menghubungi API Alfastore", status: null };
  }
  if (response.status >= 300 && response.status < 400) {
    return { success: false, message: "Dialihkan ke halaman lain (kemungkinan login)", status: response.status };
  }
  // Beberapa endpoint mengembalikan format `200^{...}`.
  const prefixed = /^(\d{3})\^/.exec(raw);
  const actualStatus = prefixed ? Number(prefixed[1]) : response.status;
  const body = prefixed ? raw.slice(prefixed[0].length).trim() : raw;
  if (!response.ok || actualStatus < 200 || actualStatus >= 300) {
    return { success: false, message: "Status kesalahan dari Alfastore", status: actualStatus };
  }
  if (!body || /^\s*</.test(body)) {
    return { success: false, message: body ? "API mengembalikan HTML, bukan data" : "Respons API kosong", status: actualStatus };
  }
  try {
    let parsed: unknown = JSON.parse(body);
    if (typeof parsed === "string") {
      const s = parsed.trim();
      if (s.startsWith("{") || s.startsWith("[")) parsed = JSON.parse(s);
    }
    const error = get(dict(parsed), ["error", "errorMessage"]);
    if (typeof error === "string" && error.trim()) {
      return { success: false, message: error.slice(0, 160), status: actualStatus };
    }
    return { success: true, data: parsed };
  } catch {
    return { success: false, message: "Respons API bukan JSON yang dapat dibaca", status: actualStatus };
  }
}

const PLU_KEYS = ["plu", "pluCode", "kodePlu", "kdPlu", "kdBarang", "kodeBarang", "itemCode", "productCode", "sku", "barcode"];
const NAME_KEYS = ["descp", "description", "deskripsi", "namaBarang", "nama_barang", "itemName", "productName", "name", "itemDesc", "nama"];
const QTY_KEYS = ["qty", "quantity", "jumlah", "itemQty", "qtyJual", "qtySales", "jml", "totalQty", "salesQty"];
const PRICE_KEYS = ["hargaJual", "harga_jual", "unitPrice", "price", "harga", "sellingPrice", "priceSell"];
const TOTAL_KEYS = ["subtotal", "subTotal", "totalPrice", "amount", "lineTotal", "totalAmount", "netAmount", "totalHarga"];
const DATE_KEYS = ["dateTx", "tanggalTransaksi", "transactionDate", "tglTransaksi", "tgl", "saleDate", "tanggal"];
const NIK_KEYS = ["userId", "nikKasir", "nik", "cashierId", "kasirNik"];

function pageCount(payload: unknown): number {
  const root = dict(payload);
  const data = dict(root?.data);
  const candidates = [root, data, dict(root?.meta), dict(root?.pagination), dict(data?.meta), dict(data?.pagination)];
  for (const group of candidates) {
    const value = get(group, ["totalPages", "totalPage", "lastPage", "last_page", "pageCount"]);
    if (value !== undefined && /^\d+$/.test(str(value))) return Math.max(1, Number(value));
  }
  return 1;
}

function extractDetails(payload: unknown, userId: string, dateTx: string): { items: Detail[]; hasArray: boolean; hasNonemptyArray: boolean; limited: boolean } {
  const items: Detail[] = [];
  const visited = new Set<object>();
  let hasArray = false;
  let hasNonemptyArray = false;
  let limited = false;

  function walk(value: unknown, depth: number, inheritedNik?: string, inheritedDate?: string) {
    if (depth > 10 || limited || !value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      hasArray = true;
      if (value.length) hasNonemptyArray = true;
      for (const item of value) walk(item, depth + 1, inheritedNik, inheritedDate);
      return;
    }
    const record = value as Dict;
    const nik = str(get(record, NIK_KEYS)) || inheritedNik;
    const date = normalizeDate(get(record, DATE_KEYS)) || inheritedDate;
    const plu = str(get(record, PLU_KEYS));
    if (plu) {
      // Bila API mengembalikan identitas kasir/tanggal per baris, pastikan cocok.
      if (nik && nik !== userId) return;
      if (date && date !== dateTx) return;
      if (items.length >= MAX_ROWS) { limited = true; return; }
      items.push({
        plu,
        name: str(get(record, NAME_KEYS)) || null,
        qty: get(record, QTY_KEYS) ?? null,
        price: get(record, PRICE_KEYS) ?? null,
        total: get(record, TOTAL_KEYS) ?? null,
      });
      return;
    }
    // Baca semua array/objek bersarang (items, detail, transaksi, result, data dsb).
    for (const item of Object.values(record)) {
      if (item !== null && typeof item === "object") walk(item, depth + 1, nik, date);
    }
  }
  walk(payload, 0);
  return { items, hasArray, hasNonemptyArray, limited };
}

export function GET() {
  return respond({
    status: "route_aktif",
    storeId: "Dinamis (sesuai form)",
    service: "Cari seluruh PLU penjualan per NIK dan tanggal",
    method: "POST",
    fields: ["storeId", "userId", "dateTx"],
    note: "Tidak membutuhkan billNo. Hasil bergantung pada rincian PLU yang tersedia dari laporan Alfastore.",
  });
}

export async function POST(request: Request) {
  let input: unknown;
  try { input = await request.json(); } catch { return respond({ error: "Body harus JSON." }, 400); }
  const body = dict(input);
  const storeId = str(body?.storeId).toUpperCase();
  const userId = str(body?.userId);
  const dateTx = str(body?.dateTx);
  if (!/^[A-Z0-9]{4}$/.test(storeId)) return respond({ error: "Kode toko harus 4 huruf/angka." }, 400);
  if (!/^\d{1,20}$/.test(userId)) return respond({ error: "NIK harus 1–20 angka." }, 400);
  if (!validDate(dateTx)) return respond({ error: "Tanggal harus YYYY-MM-DD yang valid." }, 400);

  const diagnostics: { endpoint: string; status: string; httpStatus?: number | null }[] = [];
  let sawValidEmptyList = false;
  let sawNonItemizedList = false;
  for (const report of reports(storeId, userId, dateTx)) {
    const result = await fetchReport(report, storeId);
    if (!result.success) {
      diagnostics.push({ endpoint: report.name, status: result.message, httpStatus: result.status });
      continue;
    }
    const extracted = extractDetails(result.data, userId, dateTx);
    let items = extracted.items;
    const totalPages = pageCount(result.data);
    if (extracted.limited || totalPages > 20) {
      return respond({
        error: `Laporan terlalu besar untuk diambil lengkap (maksimal ${MAX_ROWS} baris / 20 halaman).`,
        code: "RESULT_TOO_LARGE", diagnostic: report.name,
      }, 422);
    }
    if (totalPages > 1) {
      // Minta halaman lanjutan hanya jika metadata API secara eksplisit menyatakan ada paginasi.
      // Gagal pada halaman berikutnya berarti data tidak boleh dianggap lengkap.
      const signatures = new Set([JSON.stringify(items.slice(0, 10))]);
      for (let page = 2; page <= totalPages; page++) {
        const next = await fetchReport(report, storeId, page);
        if (!next.success) {
          return respond({
            error: `Tidak bisa mengambil halaman ${page}/${totalPages}: ${next.message}.`,
            code: "PAGINATION_FAILED", diagnostic: report.name,
          }, 502);
        }
        const pageItems = extractDetails(next.data, userId, dateTx);
        const signature = JSON.stringify(pageItems.items.slice(0, 10));
        if (pageItems.limited || (pageItems.items.length && signatures.has(signature)) || items.length + pageItems.items.length > MAX_ROWS) {
          return respond({
            error: "Data laporan terpotong atau API mengulang halaman yang sama. Tidak menampilkan hasil yang tidak lengkap.",
            code: "PAGINATION_INCOMPLETE", diagnostic: report.name,
          }, 422);
        }
        signatures.add(signature);
        items = items.concat(pageItems.items);
      }
    }
    if (items.length) {
      return respond({
        transaction: { storeId, userId, dateTx },
        items,
        source: report.name,
        pages: totalPages,
        note: "Baris PLU diambil dari laporan Alfastore. Bukan cetak ulang tiap nomor struk.",
      });
    }
    if (extracted.hasArray && !extracted.hasNonemptyArray) sawValidEmptyList = true;
    if (extracted.hasNonemptyArray) sawNonItemizedList = true;
    diagnostics.push({ endpoint: report.name, status: "Respons diterima, tidak ditemukan baris PLU." });
  }
  if (sawValidEmptyList && !sawNonItemizedList && diagnostics.every(d => d.status.includes("tidak ditemukan baris PLU"))) {
    return respond({
      transaction: { storeId, userId, dateTx }, items: [],
      note: "Tidak ditemukan PLU dari laporan untuk parameter tersebut. Periksa tanggal dan NIK, atau struktur laporan sumber.",
      diagnostics,
    });
  }
  return respond({
    error: "Belum bisa mengambil daftar PLU. Endpoint laporan Alfastore mungkin tidak tersedia atau tidak mengirim detail per barang.",
    code: "REPORT_NOT_ITEMIZED", diagnostics,
  }, 502);
}
