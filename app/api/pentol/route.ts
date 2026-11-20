/**
 * ALFASTORE - Label Price / Check Input Filter
 * Simpan di: app/api/label_price/check_input_filter/route.ts
 *
 * Contoh URL setelah deploy:
 * https://DOMAIN-VERCEL/api/label_price/check_input_filter?storeId=M865&storeDate=20-11-2026&inputType=ITEM&inputFilter=244
 *
 * Headers permintaan ALFASTORE digabungkan seluruhnya di file ini.
 * Kunci API hanya digunakan pada server Vercel dan tidak dikembalikan ke klien.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALFASTORE_ENDPOINT =
  "https://app.alfastore.co.id/prd/api/laporan/label_price/check_input_filter";

// Sesuai screenshot header. Sebaiknya simpan API key di Environment Variables
// Vercel (ALFASTORE_API_KEY). Nilai dari screenshot disediakan sebagai fallback
// agar satu file route.ts ini dapat langsung dipasang tanpa file konfigurasi lain.
const API_KEY =
  process.env.ALFASTORE_API_KEY?.trim() ||
  "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";

const DEFAULT_STORE_ID = "M865";
const DEFAULT_USER_ID = "20020884";
const DEFAULT_BRANCH_ID = "MZ01";
const UPSTREAM_TIMEOUT_MS = 25000;

function todayInJakarta(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("day")}-${get("month")}-${get("year")}`;
}

function replyJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    },
  });
}

function readParam(
  query: URLSearchParams,
  body: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const fromBody = body[key];
  const raw =
    (typeof fromBody === "string" || typeof fromBody === "number"
      ? String(fromBody)
      : undefined) ?? query.get(key) ?? fallback;
  return raw.trim();
}

async function handler(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  let body: Record<string, unknown> = {};

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const parsed: unknown = await request.json();
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          return replyJson({ success: false, message: "Body JSON harus objek." }, 400);
        }
        body = parsed as Record<string, unknown>;
      } else {
        body = Object.fromEntries(new URLSearchParams(await request.text()));
      }
    } catch {
      return replyJson({ success: false, message: "Body permintaan tidak valid." }, 400);
    }
  }

  const storeId = readParam(query, body, "storeId", DEFAULT_STORE_ID).toUpperCase();
  const storeDate = readParam(query, body, "storeDate", todayInJakarta());
  const inputType = readParam(query, body, "inputType", "ITEM").toUpperCase();
  const inputFilter = readParam(query, body, "inputFilter");
  const userId = readParam(query, body, "userId", DEFAULT_USER_ID);
  const branchId = readParam(query, body, "branchId", DEFAULT_BRANCH_ID).toUpperCase();

  if (!/^[A-Z0-9]{4,10}$/.test(storeId)) {
    return replyJson({ success: false, message: "storeId tidak valid." }, 400);
  }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(storeDate)) {
    return replyJson({ success: false, message: "storeDate harus DD-MM-YYYY." }, 400);
  }
  if (!/^[A-Z_]{1,30}$/.test(inputType)) {
    return replyJson({ success: false, message: "inputType tidak valid." }, 400);
  }
  if (!inputFilter || inputFilter.length > 100) {
    return replyJson(
      { success: false, message: "inputFilter (PLU/barcode) wajib diisi, maksimal 100 karakter." },
      400,
    );
  }
  if (!/^\d{1,12}$/.test(userId) || !/^[A-Z0-9]{2,10}$/.test(branchId)) {
    return replyJson({ success: false, message: "userId atau branchId tidak valid." }, 400);
  }

  const upstreamUrl = new URL(ALFASTORE_ENDPOINT);
  upstreamUrl.searchParams.set("storeId", storeId);
  upstreamUrl.searchParams.set("storeDate", storeDate);
  upstreamUrl.searchParams.set("inputType", inputType);
  upstreamUrl.searchParams.set("inputFilter", inputFilter);

  // Header sesuai screenshot; Host diset otomatis oleh fetch berdasarkan URL.
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "python-requests/2.28.2",
    "Api-Key": API_KEY,
    "App-Name": "InventoryIntelligence",
    Platform: "ANDROID",
    "Store-Id": storeId,
    "User-Id": userId,
    "Branch-Id": branchId,
    Connection: "keep-alive",
    "Accept-Encoding": "gzip",
  });

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // Data asli ALFASTORE diteruskan, termasuk status error dan isi JSON-nya.
    const responseText = await upstreamResponse.text();
    const status = upstreamResponse.status;
    return new Response(status === 204 ? null : responseText, {
      status,
      headers: {
        "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
      },
    });
  } catch (error: unknown) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return replyJson(
      {
        success: false,
        message: timedOut
          ? "ALFASTORE tidak merespons sebelum batas waktu."
          : "Gagal terhubung ke ALFASTORE.",
        upstream: "check_input_filter",
      },
      timedOut ? 504 : 502,
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
