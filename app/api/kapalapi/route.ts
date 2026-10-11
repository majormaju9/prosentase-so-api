/**
 * Next.js App Router — src/app/api/so/route.ts
 *
 * Endpoint lokal: /api/so?action=<nama_action>
 * Semua request ke API Stock Opname dilewatkan dari server Next.js.
 * Konfigurasi API Key dan token proxy berada langsung di file SERVER ini.
 * Browser biasa tidak mengirim X-SO-Token: mendukung Basic Auth agar
 * kunjungan langsung ke URL akan memunculkan dialog login.
 * JANGAN menaruh file ini di folder frontend/client atau repositori publik.
 *
 * API yang didukung (5 GET, 3 POST):
 * GET  get_rak_tx_stEntry  -> /api/so/entry_kkso/get_rak_tx_stEntry
 * GET  get_data_entry     -> /api/so/entry_kkso/get_data_entry
 * GET  get_all_plu        -> /api/so/cetak_kkso/get_all_plu
 * GET  cek_plu_rak_bebas  -> /api/so/cetak_kkso/cek_plu_rak_bebas
 * GET  check_date_entry   -> /api/so/entry_kkso/check_date_entry
 * POST save_entry_kkso    -> /api/so/entry_kkso/save_entry_kkso
 * POST save_per_item      -> /api/so/entry_kkso/save_per_item
 * POST save_data          -> /api/so/cetak_kkso/save_data
 *
 * Catatan: bentuk parameter GET merujuk ke daftar endpoint sebelumnya;
 * payload POST save_per_item disesuaikan dengan tangkapan HTTP Request.
 * Detail payload endpoint POST lain perlu disesuaikan dengan request asli.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_BASE =
  (process.env.SO_API_BASE_URL || "https://app.alfastore.co.id/prd").replace(/\/$/, "");
const DEFAULT_STORE = "M604";

/**
 * SERVER-ONLY: nilai dari request HTTP aplikasi yang diberikan pengguna.
 * Jangan ekspor konstanta ini ke client, log, atau respon API.
 * Disarankan pindah ke environment variable saat deployment produksi.
 */
const INLINE_API_KEY = "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";
const INLINE_PROXY_TOKEN = "ByTHMADlaSRKAdW21AO5A5ojGywwiZEuoaKPI8q1qG2MVodz";
const INLINE_BRANCH_ID = "MZ01"; // Branch-Id pada screenshot; bukan Store ID.
const INLINE_ANDROID_ID = "712f8db18eeb1816"; // Androidid dan Mac-Addr pada screenshot.


const ACTIONS = {
  get_rak_tx_stEntry: {
    method: "GET",
    path: "/api/so/entry_kkso/get_rak_tx_stEntry",
  },
  get_data_entry: {
    method: "GET",
    path: "/api/so/entry_kkso/get_data_entry",
  },
  get_all_plu: {
    method: "GET",
    path: "/api/so/cetak_kkso/get_all_plu",
  },
  cek_plu_rak_bebas: {
    method: "GET",
    path: "/api/so/cetak_kkso/cek_plu_rak_bebas",
  },
  check_date_entry: {
    method: "GET",
    path: "/api/so/entry_kkso/check_date_entry",
  },
  save_entry_kkso: {
    method: "POST",
    path: "/api/so/entry_kkso/save_entry_kkso",
  },
  save_per_item: {
    method: "POST",
    path: "/api/so/entry_kkso/save_per_item",
  },
  save_data: {
    method: "POST",
    path: "/api/so/cetak_kkso/save_data",
  },
} as const;

type Action = keyof typeof ACTIONS;
type JSONRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JSONRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jakartaDate(format: "iso" | "dmy"): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (part: "day" | "month" | "year") =>
    parts.find((x) => x.type === part)?.value || "";
  const dd = get("day");
  const mm = get("month");
  const yyyy = get("year");
  return format === "iso" ? `${yyyy}-${mm}-${dd}` : `${dd}-${mm}-${yyyy}`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Token khusus untuk mengakses proxy, *bukan* Api-Key milik server SO. */
function authorized(request: NextRequest): boolean {
  const secret = process.env.SO_PROXY_TOKEN || INLINE_PROXY_TOKEN;
  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  let basicToken: string | undefined;

  // Tambahan: Chrome/browser dapat memunculkan dialog login HTTP Basic.
  // Username: so; Password: nilai SO_PROXY_TOKEN / INLINE_PROXY_TOKEN.
  const basic = authorization.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i)?.[1];
  if (basic) {
    try {
      const credentials = Buffer.from(basic, "base64").toString("utf8");
      if (credentials.startsWith("so:")) basicToken = credentials.slice(3);
    } catch {
      // Kredensial tidak valid.
    }
  }

  const supplied = bearer || request.headers.get("x-so-token") || basicToken || "";
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function unauthorizedResponse() {
  // WWW-Authenticate mengizinkan browser meminta username/password
  // alih-alih hanya menampilkan JSON Unauthorized.
  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized. Gunakan X-SO-Token, Authorization: Bearer, atau login Basic (username: so, password: token proxy).",
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Entry SO Proxy", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    },
  );
}

function upstreamHeaders(): Headers {
  const h = new Headers({
    "Api-Key": INLINE_API_KEY,
    Platform: "ANDROID",
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
  });

  // Header bawaan sesuai contoh tangkapan HTTP Request; bisa diganti via environment.
  h.set("Branch-Id", process.env.SO_BRANCH_ID || INLINE_BRANCH_ID);
  h.set("Androidid", process.env.SO_ANDROID_ID || INLINE_ANDROID_ID);
  h.set("Mac-Addr", process.env.SO_MAC_ADDR || process.env.SO_ANDROID_ID || INLINE_ANDROID_ID);
  if (process.env.SO_UPSTREAM_AUTHORIZATION)
    h.set("Authorization", process.env.SO_UPSTREAM_AUTHORIZATION);
  return h;
}

/** Hanya meneruskan parameter yang relevan untuk masing-masing endpoint. */
function buildGetURL(action: Action, request: NextRequest): URL | NextResponse {
  const input = request.nextUrl.searchParams;
  const url = new URL(`${UPSTREAM_BASE}${ACTIONS[action].path}`);
  const storeId = input.get("storeId") || input.get("kodeToko") || DEFAULT_STORE;
  const dateSo = input.get("dateSo") || jakartaDate("iso");
  const rack = input.get("rakSo") || input.get("rack") || "";
  const plu = input.get("pluBarcode") || input.get("plu") || "";
  const add = (key: string, value: string | null | undefined) => {
    if (value !== null && value !== undefined && value !== "")
      url.searchParams.set(key, value);
  };

  switch (action) {
    case "get_rak_tx_stEntry":
      add("storeId", storeId);
      add("dateSo", dateSo);
      break;

    case "get_data_entry":
      if (!rack) return jsonError("Parameter rakSo atau rack wajib diisi.", 400);
      add("kodeToko", storeId);
      add("dateSo", dateSo);
      add("rakSo", rack);
      break;

    case "get_all_plu":
      // Parameter disimpulkan dari daftar endpoint; verifikasi dengan traffic asli.
      if (!rack) return jsonError("Parameter rakSo atau rack wajib diisi.", 400);
      add("rakSo", rack);
      add("typeSo", input.get("typeSo"));
      add("kodeToko", storeId);
      add("userName", input.get("userName"));
      break;

    case "cek_plu_rak_bebas":
      if (!rack || !plu) return jsonError("Parameter rakSo dan pluBarcode wajib diisi.", 400);
      add("storeId", storeId);
      add("dateSo", dateSo);
      add("rakSo", rack);
      add("pluBarcode", plu);
      add("menuList", input.get("menuList"));
      add("lang", input.get("lang"));
      add("deviceType", input.get("deviceType") || "pda");
      add("userSo", input.get("userSo"));
      break;

    case "check_date_entry":
      add("storeId", storeId);
      add("menuList", input.get("menuList"));
      break;

    default:
      return jsonError("Action tidak mendukung GET.", 405);
  }
  return url;
}

function buildPostBody(action: Action, raw: JSONRecord): JSONRecord | NextResponse {
  // Gunakan format tanggal dd-MM-yyyy sesuai screenshot request save_per_item.
  // Format default GET memakai yyyy-MM-dd mengikuti daftar URL sebelumnya.
  const body: JSONRecord = { ...raw };

  if (action === "save_per_item") {
    if (typeof body.kodeToko !== "string" || !body.kodeToko) body.kodeToko = DEFAULT_STORE;
    if (typeof body.dateSo !== "string" || !body.dateSo) body.dateSo = jakartaDate("dmy");
    if (typeof body.rakSo !== "string" || !body.rakSo)
      return jsonError("Field rakSo wajib diisi.", 400);
    if (!Array.isArray(body.data) || body.data.length === 0)
      return jsonError("Field data wajib berupa array berisi item SO.", 400);
  } else if (action === "save_entry_kkso") {
    if (typeof body.storeId !== "string" || !body.storeId) body.storeId = DEFAULT_STORE;
    if (typeof body.dateSo !== "string" || !body.dateSo) body.dateSo = jakartaDate("dmy");
    if (!Array.isArray(body.data))
      return jsonError("Field data wajib berupa array item SO.", 400);
  }
  // save_data: struktur body belum terkonfirmasi; kirim persis seperti input.
  return body;
}

async function route(request: NextRequest, method: "GET" | "POST") {
  // API Key upstream tidak menggantikan token untuk akses API lokal.
  // Browser: gunakan dialog Basic Auth. Fetch/curl: Bearer atau X-SO-Token.
  if (!authorized(request)) return unauthorizedResponse();

  const actionName = request.nextUrl.searchParams.get("action") || "";
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, actionName))
    return jsonError(`Action tidak dikenal: ${actionName}`, 404);
  const action = actionName as Action;
  if (ACTIONS[action].method !== method)
    return jsonError(`Gunakan metode ${ACTIONS[action].method} untuk action ini.`, 405);

  const target = method === "GET"
    ? buildGetURL(action, request)
    : new URL(`${UPSTREAM_BASE}${ACTIONS[action].path}`);
  if (target instanceof NextResponse) return target;

  let body: string | undefined;
  if (method === "POST") {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonError("Body harus JSON valid.", 400);
    }
    if (!isRecord(raw)) return jsonError("Body harus JSON object.", 400);
    const result = buildPostBody(action, raw);
    if (result instanceof NextResponse) return result;
    body = JSON.stringify(result);
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers: upstreamHeaders(),
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const responseBytes = await upstream.arrayBuffer();
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    });
    return new NextResponse(responseBytes, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonError("Gagal menghubungi server Stock Opname (atau waktu habis).", 502);
  }
}

export async function GET(request: NextRequest) {
  return route(request, "GET");
}

export async function POST(request: NextRequest) {
  return route(request, "POST");
}
