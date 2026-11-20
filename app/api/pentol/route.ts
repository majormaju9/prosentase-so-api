/**
 * ALFASTORE Label Price: check_input_filter
 * Next.js App Router / Vercel
 * Lokasi WAJIB: app/api/label_price/check_input_filter/route.ts
 *
 * CEK ROUTE (tanpa memanggil ALFASTORE):
 *   GET /api/label_price/check_input_filter?health=1
 *
 * CEK PLU/BARCODE:
 *   GET /api/label_price/check_input_filter?storeId=M865&storeDate=20-11-2026&inputType=ITEM&inputFilter=244
 *
 * Semua header request digabung dalam file ini. Jangan mengirim API key ke browser.
 * Bila memungkinkan, atur ALFASTORE_API_KEY di Vercel Environment Variables.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT =
  "https://app.alfastore.co.id/prd/api/laporan/label_price/check_input_filter";

// Disalin dari header yang diberikan pengguna. Lebih aman diganti dengan env Vercel.
const API_KEY =
  process.env.ALFASTORE_API_KEY?.trim() ||
  "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";

const DEFAULT_STORE_ID = "M865";
const DEFAULT_USER_ID = "20020884";
const DEFAULT_BRANCH_ID = "MZ01";
const TIMEOUT_MS = 22000;

const COMMON_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...COMMON_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  return `${day}-${month}-${year}`;
}

function param(
  qs: URLSearchParams,
  body: Record<string, unknown>,
  key: string,
  fallback = "",
): string {
  const b = body[key];
  const value =
    (typeof b === "string" || typeof b === "number" ? String(b) : undefined) ??
    qs.get(key) ??
    fallback;
  return value.trim();
}

function validDate(v: string): boolean {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCDate() === day &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCFullYear() === year
  );
}

type Attempt = {
  method: "GET" | "POST";
  status: number;
  statusText: string;
  message?: string;
};

function parseJsonIfPossible(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const obj = value as Record<string, unknown>;
  return typeof obj.message === "string" ? obj.message : undefined;
}

function makeHeaders(storeId: string, userId: string, branchId: string): Headers {
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
  // Header Host ditangani otomatis oleh fetch sesuai host endpoint (app.alfastore.co.id).
  return headers;
}

async function handler(request: Request): Promise<Response> {
  const qs = new URL(request.url).searchParams;

  // Saat health=1, verifikasi route Vercel tanpa perlu autentikasi/upstream.
  if (qs.get("health") === "1") {
    return json({
      success: true,
      message: "Route Vercel aktif",
      source: "vercel_route",
      path: "/api/label_price/check_input_filter",
      upstream: "/prd/api/laporan/label_price/check_input_filter",
      requestMethods: ["GET", "POST"],
    });
  }

  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    try {
      const type = request.headers.get("content-type") || "";
      if (type.includes("application/json")) {
        const value: unknown = await request.json();
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return json({ success: false, message: "Body JSON harus berupa objek." }, 400);
        }
        body = value as Record<string, unknown>;
      } else {
        body = Object.fromEntries(new URLSearchParams(await request.text()));
      }
    } catch {
      return json({ success: false, message: "Body POST tidak valid." }, 400);
    }
  }

  const storeId = param(qs, body, "storeId", DEFAULT_STORE_ID).toUpperCase();
  const storeDate = param(qs, body, "storeDate", jakartaToday());
  const inputType = param(qs, body, "inputType", "ITEM").toUpperCase();
  const inputFilter = param(qs, body, "inputFilter");
  const userId = param(qs, body, "userId", DEFAULT_USER_ID);
  const branchId = param(qs, body, "branchId", DEFAULT_BRANCH_ID).toUpperCase();

  if (!/^[A-Z0-9]{4,10}$/.test(storeId)) {
    return json({ success: false, message: "storeId tidak valid." }, 400);
  }
  if (!validDate(storeDate)) {
    return json({ success: false, message: "storeDate harus tanggal valid DD-MM-YYYY." }, 400);
  }
  if (!/^[A-Z_]{1,30}$/.test(inputType)) {
    return json({ success: false, message: "inputType tidak valid." }, 400);
  }
  if (!inputFilter || inputFilter.length > 100) {
    return json({ success: false, message: "inputFilter (PLU/barcode) wajib diisi (maks. 100 karakter)." }, 400);
  }
  if (!/^\d{1,12}$/.test(userId)) {
    return json({ success: false, message: "userId tidak valid." }, 400);
  }
  if (!/^[A-Z0-9]{2,10}$/.test(branchId)) {
    return json({ success: false, message: "branchId tidak valid." }, 400);
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("storeId", storeId);
  url.searchParams.set("storeDate", storeDate);
  url.searchParams.set("inputType", inputType);
  url.searchParams.set("inputFilter", inputFilter);

  const headers = makeHeaders(storeId, userId, branchId);
  const attempts: Attempt[] = [];

  // Pertama GET sesuai URL yang diberikan. Jika 404/405, coba POST karena
  // beberapa gateway hanya mendaftarkan salah satu HTTP method.
  for (const method of ["GET", "POST"] as const) {
    try {
      const upstream = await fetch(url, {
        method,
        headers,
        ...(method === "POST"
          ? {
              body: JSON.stringify({ storeId, storeDate, inputType, inputFilter }),
            }
          : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const responseText = await upstream.text();
      const decoded = parseJsonIfPossible(responseText);
      const upstreamMessage = messageFrom(decoded);
      attempts.push({
        method,
        status: upstream.status,
        statusText: upstream.statusText,
        ...(upstreamMessage ? { message: upstreamMessage } : {}),
      });

      const routeNotFound =
        upstream.status === 404 ||
        upstream.status === 405 ||
        (typeof upstreamMessage === "string" &&
          /route not found/i.test(upstreamMessage));

      if (routeNotFound && method === "GET") {
        continue;
      }

      if (routeNotFound) {
        return json(
          {
            success: false,
            source: "alfastore_upstream",
            message: "Endpoint ALFASTORE mengembalikan 'Route not found'. Route Vercel berfungsi, namun endpoint upstream belum ditemukan untuk GET maupun POST.",
            upstreamEndpoint: url.origin + url.pathname,
            params: { storeId, storeDate, inputType, inputFilter },
            attempts,
            upstreamResponse: decoded,
            note: "Periksa URL endpoint asli di Network/THOR dan metode HTTP yang tepat. Header atau API key saja tidak dapat memperbaiki path yang tidak terdaftar.",
          },
          502,
        );
      }

      if (!upstream.ok) {
        return json(
          {
            success: false,
            source: "alfastore_upstream",
            message: "ALFASTORE mengembalikan error HTTP.",
            upstreamStatus: upstream.status,
            attempts,
            upstreamResponse: decoded,
          },
          upstream.status >= 500 ? 502 : upstream.status,
        );
      }

      // Respons sukses dikembalikan apa adanya agar kompatibel dengan web lama.
      return new Response(upstream.status === 204 ? null : responseText, {
        status: upstream.status,
        headers: {
          ...COMMON_HEADERS,
          "Content-Type":
            upstream.headers.get("content-type") ||
            "application/json; charset=utf-8",
          "X-Proxy-Source": "alfastore_upstream",
          "X-Proxy-Method": method,
        },
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError");
      return json(
        {
          success: false,
          source: "vercel_proxy_transport",
          message: timedOut
            ? "ALFASTORE tidak merespons hingga batas waktu."
            : "Gagal menghubungi server ALFASTORE.",
          attemptedMethod: method,
          attempts,
        },
        timedOut ? 504 : 502,
      );
    }
  }

  return json({ success: false, message: "Tidak ada percobaan upstream berhasil." }, 502);
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
    headers: { ...COMMON_HEADERS, "Access-Control-Max-Age": "86400" },
  });
}
