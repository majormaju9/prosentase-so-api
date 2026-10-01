import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL =
  "https://app.alfastore.co.id/prd/api/mob/tablet/pricetag";

/*
 * Environment tetap didukung.
 * Jika belum dibuat di Vercel, fallback di bawah memakai data request
 * yang diberikan agar endpoint /api/price tidak lagi error HTTP 500.
 *
 * Disarankan setelah API sudah normal:
 * - ALFASTORE_API_KEY
 * - ALFASTORE_APP_UID
 * - ALFASTORE_BRANCH_ID
 * - ALFASTORE_CLASS_STORE
 * - ALFASTORE_COMPANY_ID
 */

const FALLBACK = {
  apiKey: "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
  appUid: "712f8db18eeb1816",
  branchId: "MZ01",
  classStore: "V",
  companyId: "SAT",
};

function cleanStore(value: string | null): string {
  const store = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

  return store;
}

function cleanCode(value: string | null, max = 50): string {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._/-]/g, "")
    .slice(0, max);
}

function buildHeaders(storeId: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "App-Name": "PRTAG-PDA",
    "App-Uid": process.env.ALFASTORE_APP_UID || FALLBACK.appUid,
    "Store-Id": storeId,
    "Api-Key": process.env.ALFASTORE_API_KEY || FALLBACK.apiKey,
    "Branch-Id":
      process.env.ALFASTORE_BRANCH_ID || FALLBACK.branchId,
    "Class-Store":
      process.env.ALFASTORE_CLASS_STORE || FALLBACK.classStore,
    "Company-Id":
      process.env.ALFASTORE_COMPANY_ID || FALLBACK.companyId,
    Platform: "ANDROID",
    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
  };
}

function errorJson(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      status,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}

/*
 * Proxy respons upstream apa adanya.
 * Ini penting supaya label_price.php menerima bentuk JSON asli dari
 * API Alfastore, bukan JSON yang dibungkus ulang.
 */
async function forward(
  targetUrl: string,
  method: "GET" | "POST" | "DELETE",
  storeId: string
) {
  try {
    const init: RequestInit = {
      method,
      headers: buildHeaders(storeId),
      cache: "no-store",
      redirect: "follow",
    };

    /*
     * check_scan pada request asli menggunakan POST dengan body kosong.
     */
    if (method === "POST") {
      init.body = "";
    }

    const response = await fetch(targetUrl, init);
    const raw = await response.text();

    const headers = new Headers();
    headers.set(
      "Content-Type",
      response.headers.get("content-type") ||
        "application/json; charset=utf-8"
    );
    headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return new NextResponse(raw, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menghubungi API Alfastore.";

    return errorJson(message, 502);
  }
}

/*
 * GET
 * /api/price?action=get_lprice&storeId=M604
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action =
    searchParams.get("action") || "get_lprice";

  const storeId = cleanStore(
    searchParams.get("storeId") ||
      searchParams.get("storeid") ||
      searchParams.get("store")
  );

  if (!storeId) {
    return errorJson("storeId wajib diisi.", 422);
  }

  if (action !== "get_lprice") {
    return errorJson("Action GET tidak dikenal.", 400);
  }

  const target = new URL(`${BASE_URL}/get_lprice/`);
  target.searchParams.set("storeId", storeId);

  return forward(target.toString(), "GET", storeId);
}

/*
 * POST
 * /api/price?action=check_scan
 *   &storeId=M604
 *   &barcode=8710103910732
 *   &region=1
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action =
    searchParams.get("action") || "check_scan";

  const storeId = cleanStore(
    searchParams.get("storeId") ||
      searchParams.get("storeid") ||
      searchParams.get("store")
  );

  const barcode = cleanCode(
    searchParams.get("barcode"),
    50
  );

  const region =
    cleanCode(searchParams.get("region") || "1", 10) ||
    "1";

  if (action !== "check_scan") {
    return errorJson("Action POST tidak dikenal.", 400);
  }

  if (!storeId) {
    return errorJson("storeId wajib diisi.", 422);
  }

  if (!barcode) {
    return errorJson("barcode wajib diisi.", 422);
  }

  const target = new URL(`${BASE_URL}/check_scan/`);
  target.searchParams.set("storeid", storeId);
  target.searchParams.set("barcode", barcode);
  target.searchParams.set("region", region);

  return forward(target.toString(), "POST", storeId);
}

/*
 * DELETE PLU:
 * /api/price?action=delete_plu
 *   &storeId=M604
 *   &plu=454318
 *   &rack=AU5
 *
 * DELETE PLU tanpa rack:
 * /api/price?action=delete_plu
 *   &storeId=M604
 *   &plu=428695
 *   &rack=
 *
 * CLEAR:
 * /api/price?action=clear_lprice
 *   &storeId=M604
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action");

  const storeId = cleanStore(
    searchParams.get("storeId") ||
      searchParams.get("storeid") ||
      searchParams.get("store")
  );

  if (!storeId) {
    return errorJson("storeId wajib diisi.", 422);
  }

  if (action === "delete_plu") {
    const plu = cleanCode(searchParams.get("plu"), 50);
    const rack = cleanCode(
      searchParams.get("rack") ?? "",
      50
    );

    if (!plu) {
      return errorJson(
        "plu wajib diisi untuk delete_plu.",
        422
      );
    }

    const target = new URL(`${BASE_URL}/delete_plu/`);
    target.searchParams.set("storeid", storeId);
    target.searchParams.set("plu", plu);

    /*
     * rack tetap selalu dikirim, termasuk string kosong,
     * sesuai request yang diberikan.
     */
    target.searchParams.set("rack", rack);

    return forward(target.toString(), "DELETE", storeId);
  }

  if (action === "clear_lprice") {
    const target = new URL(`${BASE_URL}/clear_lprice/`);
    target.searchParams.set("storeid", storeId);

    return forward(target.toString(), "DELETE", storeId);
  }

  return errorJson(
    "Action DELETE wajib delete_plu atau clear_lprice.",
    400
  );
}
