/**
 * Entry SO / KKSO - Next.js App Router (server-only)
 * URL: https://lautanapi.vercel.app/api/kapalapi
 *
 * API untuk UI index.html:
 *   GET  ?type=ping
 *   GET  ?type=rack&storeId=M604&date=2026-10-12
 *   GET  ?type=item&storeId=M604&date=2026-10-12&rack=ZR1
 *   GET  ?type=cek&storeId=M604&date=2026-10-12&rack=ZR1&plu=262564
 *   GET  ?type=saldo&storeId=M604&plu=262564
 *   POST ?type=save  { kodeToko, dateSo, rakSo, data: [...] }
 *
 * Juga mendukung 8 action asli lewat ?action=... (lihat ACTIONS).
 * Semua request data dan penyimpanan membutuhkan header X-SO-Token.
 * Endpoint ping sengaja dapat diakses tanpa token untuk diagnostik.
 *
 * Penting: nilai key/token bawaan dari konfigurasi terdahulu adalah RAHASIA.
 * File ini hanya boleh berada pada sisi server. Untuk produksi, gunakan
 * environment SO_API_KEY / SO_PROXY_TOKEN dan rotasi kredensial yang terlanjur tersebar.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_BASE = (process.env.SO_API_BASE_URL || "https://app.alfastore.co.id/prd").replace(/\/+$/, "");
const DEFAULT_STORE = "M604";

// Server-side only. Nilai dari capture permintaan Android yang diberikan pengguna.
// Lebih aman mengisinya melalui Environment Variables Vercel, bukan Git publik.
const INLINE_API_KEY = "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";
const INLINE_PROXY_TOKEN = "ByTHMADlaSRKAdW21AO5A5ojGywwiZEuoaKPI8q1qG2MVodz";
const INLINE_BRANCH_ID = "MZ01";
const INLINE_ANDROID_ID = "712f8db18eeb1816";

const ACTIONS = {
  get_rak_tx_stEntry: { method: "GET", path: "/api/so/entry_kkso/get_rak_tx_stEntry" },
  get_data_entry: { method: "GET", path: "/api/so/entry_kkso/get_data_entry" },
  get_all_plu: { method: "GET", path: "/api/so/cetak_kkso/get_all_plu" },
  cek_plu_rak_bebas: { method: "GET", path: "/api/so/cetak_kkso/cek_plu_rak_bebas" },
  check_date_entry: { method: "GET", path: "/api/so/entry_kkso/check_date_entry" },
  save_entry_kkso: { method: "POST", path: "/api/so/entry_kkso/save_entry_kkso" },
  save_per_item: { method: "POST", path: "/api/so/entry_kkso/save_per_item" },
  save_data: { method: "POST", path: "/api/so/cetak_kkso/save_data" },
} as const;

type Action = keyof typeof ACTIONS;
type Dict = Record<string, unknown>;

function isRecord(value: unknown): value is Dict {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function first(obj: Dict, keys: string[]): unknown {
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

function jakartaISO(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
  }).formatToParts(new Date());
  const p = (kind: "day" | "month" | "year") => parts.find(x => x.type === kind)?.value || "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

function dateISO(value: unknown): string | null {
  const input = str(value) || jakartaISO();
  let dd: string, mm: string, yyyy: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    [yyyy, mm, dd] = input.split("-");
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
    [dd, mm, yyyy] = input.split("-");
  } else return null;
  const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== `${yyyy}-${mm}-${dd}`) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function dateDMY(value: unknown): string | null {
  const iso = dateISO(value);
  return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : null;
}

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-SO-Token, Authorization",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  });
}

function reply(data: Dict, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

function fail(error: string, status = 400, detail?: unknown): NextResponse {
  return reply({ ok: false, error, ...(detail === undefined ? {} : { detail }) }, status);
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.SO_PROXY_TOKEN || INLINE_PROXY_TOKEN;
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  const supplied = request.headers.get("x-so-token") || bearer || "";
  const lhs = Buffer.from(expected);
  const rhs = Buffer.from(supplied);
  return lhs.length === rhs.length && timingSafeEqual(lhs, rhs);
}

function upstreamHeaders(): Headers {
  const result = new Headers({
    "Api-Key": process.env.SO_API_KEY || INLINE_API_KEY,
    "Branch-Id": process.env.SO_BRANCH_ID || INLINE_BRANCH_ID,
    "Androidid": process.env.SO_ANDROID_ID || INLINE_ANDROID_ID,
    "Mac-Addr": process.env.SO_MAC_ADDR || process.env.SO_ANDROID_ID || INLINE_ANDROID_ID,
    Platform: "ANDROID",
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (process.env.SO_UPSTREAM_AUTHORIZATION) result.set("Authorization", process.env.SO_UPSTREAM_AUTHORIZATION);
  return result;
}

function requestStore(params: URLSearchParams): string {
  return str(params.get("storeId") || params.get("kodeToko") || DEFAULT_STORE).toUpperCase();
}

function requestRack(params: URLSearchParams): string {
  return str(params.get("rack") || params.get("rakSo"));
}

function requestPlu(params: URLSearchParams): string {
  return str(params.get("plu") || params.get("pluBarcode"));
}

function requestDate(params: URLSearchParams): string | null {
  return dateISO(params.get("date") || params.get("dateSo"));
}

function setIf(url: URL, key: string, value: string | null) {
  if (value) url.searchParams.set(key, value);
}

function buildUpstreamURL(action: Action, params: URLSearchParams): URL | NextResponse {
  const url = new URL(UPSTREAM_BASE + ACTIONS[action].path);
  const store = requestStore(params);
  const date = requestDate(params);
  const rack = requestRack(params);
  const plu = requestPlu(params);
  if (!date) return fail("Tanggal tidak valid. Gunakan yyyy-MM-dd atau dd-MM-yyyy.");

  switch (action) {
    case "get_rak_tx_stEntry":
      url.searchParams.set("storeId", store);
      url.searchParams.set("dateSo", date);
      break;
    case "get_data_entry":
      if (!rack) return fail("Pilih rack terlebih dahulu.");
      url.searchParams.set("kodeToko", store);
      url.searchParams.set("dateSo", date);
      url.searchParams.set("rakSo", rack);
      break;
    case "get_all_plu":
      if (!rack) return fail("Parameter rack wajib diisi.");
      url.searchParams.set("rakSo", rack);
      url.searchParams.set("kodeToko", store);
      setIf(url, "typeSo", params.get("typeSo"));
      setIf(url, "userName", params.get("userName"));
      // Bentuk param get_all_plu belum diverifikasi dari tangkapan jaringan.
      break;
    case "cek_plu_rak_bebas":
      if (!rack || !plu) return fail("Parameter rack dan plu wajib diisi.");
      url.searchParams.set("storeId", store);
      url.searchParams.set("dateSo", date);
      url.searchParams.set("rakSo", rack);
      url.searchParams.set("pluBarcode", plu);
      setIf(url, "menuList", params.get("menuList"));
      setIf(url, "lang", params.get("lang"));
      url.searchParams.set("deviceType", params.get("deviceType") || "pda");
      setIf(url, "userSo", params.get("userSo"));
      break;
    case "check_date_entry":
      url.searchParams.set("storeId", store);
      setIf(url, "menuList", params.get("menuList"));
      break;
    default:
      return fail("Action bukan metode GET.", 405);
  }
  return url;
}

async function upstreamFetch(url: URL, method: "GET" | "POST", body?: Dict) {
  const res = await fetch(url, {
    method,
    headers: upstreamHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(24000),
  });
  const raw = await res.text();
  let data: unknown = raw;
  if (raw) {
    try { data = JSON.parse(raw); } catch { /* text/html response kept */ }
  }
  return { status: res.status, httpOK: res.ok, data };
}

function upstreamError(data: unknown): string | null {
  if (!isRecord(data)) return null;
  if (data.ok === false || data.success === false || data.status === false) {
    return str(first(data, ["message", "error", "msg", "pesan"])) || "Upstream melaporkan operasi gagal.";
  }
  return null;
}

function arrayFrom(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  for (const key of ["data", "items", "result", "results", "rows", "list", "payload"]) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
    if (isRecord(value[key])) {
      const nested = arrayFrom(value[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeRack(value: unknown): Dict | null {
  if (typeof value === "string" || typeof value === "number") {
    const v = str(value);
    return v ? { rack_no: v, rack_name: "RAK" } : null;
  }
  if (!isRecord(value)) return null;
  const rack = str(first(value, ["rack_no", "rackNo", "rakSo", "rack", "rak", "kodeRak", "kode_rak", "kode", "RACK_NO"]));
  if (!rack) return null;
  return { ...value, rack_no: rack, rack_name: str(first(value, ["rack_name", "rackName", "namaRak", "nama", "description", "descp"])) || "RAK" };
}

function normalizeItem(value: unknown): Dict | null {
  if (!isRecord(value)) return null;
  const plu = first(value, ["plu", "PLU", "plu_no", "pluNo", "article_code", "kode"]);
  if (plu === undefined) return null;
  return {
    ...value,
    plu,
    item_descp: str(first(value, ["item_descp", "descp", "description", "nama", "item_name", "nama_barang", "item_desc"])) || "-",
    barcode: str(first(value, ["barcode", "barcode_no"])) || "0",
    qty: Number(first(value, ["qty", "QTY"]) ?? 0) || 0,
    avg_cost: Number(first(value, ["avg_cost", "avgCost"]) ?? 0) || 0,
    tag: str(first(value, ["tag", "f_tag"])) || "K",
  };
}

function getItemFromResponse(payload: unknown, plu: string): Dict | null {
  const rows = arrayFrom(payload);
  for (const value of rows) {
    const item = normalizeItem(value);
    if (item && (str(item.plu) === plu || (str(item.barcode) !== "0" && str(item.barcode) === plu))) return item;
  }
  if (isRecord(payload)) {
    const nested = isRecord(payload.data) ? payload.data : payload;
    const item = normalizeItem(nested);
    if (item && (str(item.plu) === plu || (str(item.barcode) !== "0" && str(item.barcode) === plu))) return item;
  }
  return null;
}

function normalizedSOItem(raw: unknown): Dict | null {
  if (!isRecord(raw)) return null;
  const p = first(raw, ["plu", "PLU", "article_code"]);
  if (p === undefined) return null;
  const plu = str(p);
  const qty = Number(first(raw, ["qty", "QTY"]) ?? 0);
  if (!plu || !Number.isFinite(qty) || qty < 0) return null;
  return {
    plu: /^\d+$/.test(plu) ? Number(plu) : plu,
    descp: str(first(raw, ["descp", "item_descp", "description", "nama"])) || "",
    conv1: Number(raw.conv1 ?? 0),
    conv2: Number(raw.conv2 ?? 0),
    subdept: Number(raw.subdept ?? 0),
    barcode: str(raw.barcode ?? "0"),
    tag: str(raw.tag ?? "K"),
    qty: String(qty),
    avg_cost: Number(raw.avg_cost ?? 0),
  };
}

function buildSaveBody(action: Action, body: Dict): Dict | NextResponse {
  if (action === "save_data") return body; // bentuk payload endpoint ini belum terverifikasi
  const store = str(body.kodeToko ?? body.storeId ?? DEFAULT_STORE).toUpperCase();
  const date = dateDMY(body.dateSo ?? body.date);
  if (!date) return fail("dateSo tidak valid. Gunakan yyyy-MM-dd atau dd-MM-yyyy.");
  if (!Array.isArray(body.data) || !body.data.length) return fail("data wajib array item yang tidak kosong.");
  if (action === "save_per_item") {
    const rack = str(body.rakSo ?? body.rack);
    if (!rack) return fail("rakSo / rack wajib diisi.");
    const items = body.data.map(normalizedSOItem);
    if (items.some(x => !x)) return fail("PLU atau QTY ada yang tidak valid.");
    return { kodeToko: store, dateSo: date, rakSo: rack, data: items };
  }
  // save_entry_kkso punya payload berbeda; pertahankan field dari pemanggil.
  return { ...body, storeId: store, dateSo: date };
}

/** Optional: saldo menggunakan sumber yang sama seperti HTML pengguna sebelumnya. */
async function getSaldo(store: string, plu: string): Promise<Dict> {
  const SOURCE = process.env.SO_SALDO_SOURCE_URL || "https://kalkulatorsaya.my.id/api/report/Saldo_proxy.php";
  const url = new URL(SOURCE);
  url.searchParams.set("storeId", store);
  url.searchParams.set("plu", plu);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { ok: false, error: `Sumber OH membalas HTTP ${res.status}`, data: null };
  const raw = await res.text();
  try {
    const j: unknown = JSON.parse(raw);
    if (isRecord(j)) {
      const v = first(j, ["saldo", "oh", "on_hand", "onHand"])
        ?? (isRecord(j.data) ? first(j.data, ["saldo", "oh", "on_hand", "onHand"]) : undefined);
      if (v !== undefined && Number.isFinite(Number(v))) return { ok: true, saldo: Number(v) };
    }
  } catch { /* table HTML */ }
  // Parser ringan untuk respons tabel saldo terdahulu: kolom PLU ke-2, OH ke-9.
  for (const row of raw.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const cells = Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), x =>
      x[1].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim());
    if (cells.length >= 9 && cells[1].replace(/^0+/, "") === plu.replace(/^0+/, "")) {
      const parsed = Number(cells[8].replace(/,/g, "").trim());
      if (Number.isFinite(parsed)) return { ok: true, saldo: parsed };
    }
  }
  return { ok: true, saldo: null, message: "OH tidak ditemukan pada sumber data." };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = str(params.get("type") || params.get("action") || "ping");
  if (type === "ping") {
    return reply({ ok: true, service: "ENTRY SO / kapalapi", dateWIB: jakartaISO(),
      usage: "Gunakan ?type=rack|item|cek|saldo atau POST ?type=save; sertakan X-SO-Token." });
  }
  if (!authorized(request)) return fail("Token API tidak valid. Isi X-SO-Token pada aplikasi Entry SO.", 401);
  if (type === "saldo") {
    const plu = requestPlu(params);
    if (!plu) return fail("Parameter plu wajib diisi.");
    try { return reply(await getSaldo(requestStore(params), plu)); }
    catch { return fail("Gagal mengambil OH dari sumber saldo.", 502); }
  }

  const aliases: Record<string, Action> = {
    rack: "get_rak_tx_stEntry", item: "get_data_entry", cek: "cek_plu_rak_bebas",
  };
  const action = (aliases[type] || type) as Action;
  if (!(action in ACTIONS)) return fail(`Type/action tidak dikenal: ${type}`, 404);
  if (ACTIONS[action].method !== "GET") return fail("Endpoint ini harus POST.", 405);
  const url = buildUpstreamURL(action, params);
  if (url instanceof NextResponse) return url;

  try {
    const fetched = await upstreamFetch(url, "GET");
    if (!fetched.httpOK) return fail(`Server Stock Opname membalas HTTP ${fetched.status}`, fetched.status >= 400 && fetched.status <= 599 ? fetched.status : 502, fetched.data);
    const err = upstreamError(fetched.data);
    if (err) return fail(err, 422, fetched.data);
    if (type === "rack") {
      const rows = arrayFrom(fetched.data).map(normalizeRack).filter((r): r is Dict => !!r);
      return reply({ ok: true, data: rows, count: rows.length });
    }
    if (type === "item") {
      const rows = arrayFrom(fetched.data).map(normalizeItem).filter((r): r is Dict => !!r);
      return reply({ ok: true, data: rows, count: rows.length });
    }
    if (type === "cek") {
      const plu = requestPlu(params);
      let item = getItemFromResponse(fetched.data, plu);
      if (!item) {
        // Beberapa server hanya mengembalikan status cek PLU, bukan detailnya.
        const itemURL = buildUpstreamURL("get_data_entry", params);
        if (itemURL instanceof URL) {
          const more = await upstreamFetch(itemURL, "GET");
          if (more.httpOK && !upstreamError(more.data)) item = getItemFromResponse(more.data, plu);
        }
      }
      if (!item) return reply({ ok: false, error: `PLU ${plu} tidak ada dalam data rack atau response tidak berisi detail item.`, data: null }, 404);
      return reply({ ok: true, data: item });
    }
    return reply({ ok: true, data: fetched.data });
  } catch {
    return fail("Gagal menghubungi server Stock Opname atau waktu tunggu habis.", 502);
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return fail("Token API tidak valid. Isi X-SO-Token pada aplikasi Entry SO.", 401);
  const params = request.nextUrl.searchParams;
  const type = str(params.get("type") || params.get("action") || "");
  const action: Action = type === "save" ? "save_per_item" : type as Action;
  if (!(action in ACTIONS)) return fail(`Type/action tidak dikenal: ${type}`, 404);
  if (ACTIONS[action].method !== "POST") return fail("Endpoint ini harus GET.", 405);
  let body: unknown;
  try { body = await request.json(); }
  catch { return fail("Request body harus JSON valid."); }
  if (!isRecord(body)) return fail("Request body harus JSON object.");
  const data = buildSaveBody(action, body);
  if (data instanceof NextResponse) return data;
  try {
    const url = new URL(UPSTREAM_BASE + ACTIONS[action].path);
    const fetched = await upstreamFetch(url, "POST", data);
    if (!fetched.httpOK) return fail(`Server Stock Opname membalas HTTP ${fetched.status}`, fetched.status >= 400 && fetched.status <= 599 ? fetched.status : 502, fetched.data);
    const err = upstreamError(fetched.data);
    if (err) return fail(err, 422, fetched.data);
    return reply({ ok: true, message: "Server mengembalikan HTTP sukses; periksa data respons untuk status bisnis.", data: fetched.data });
  } catch {
    return fail("Gagal menyimpan ke server Stock Opname atau waktu tunggu habis.", 502);
  }
}
