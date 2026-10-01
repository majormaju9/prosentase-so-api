import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://app.alfastore.co.id/prd/api/mob/tablet/pricetag";

/**
 * Simpan credential server-side di environment:
 * ALFASTORE_API_KEY=...
 * ALFASTORE_APP_UID=...
 *
 * Opsional:
 * ALFASTORE_BRANCH_ID=MZ01
 * ALFASTORE_CLASS_STORE=V
 * ALFASTORE_COMPANY_ID=SAT
 */

function buildHeaders(storeId: string): HeadersInit {
  const apiKey = process.env.ALFASTORE_API_KEY;
  const appUid = process.env.ALFASTORE_APP_UID;

  if (!apiKey || !appUid) {
    throw new Error(
      "ALFASTORE_API_KEY atau ALFASTORE_APP_UID belum diset di environment server."
    );
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    "App-Name": "PRTAG-PDA",
    "App-Uid": appUid,
    "Store-Id": storeId,
    "Api-Key": apiKey,
    "Branch-Id": process.env.ALFASTORE_BRANCH_ID || "MZ01",
    "Class-Store": process.env.ALFASTORE_CLASS_STORE || "V",
    "Company-Id": process.env.ALFASTORE_COMPANY_ID || "SAT",
    Platform: "ANDROID",
  };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    { status }
  );
}

async function forward(
  targetUrl: string,
  method: "GET" | "POST" | "DELETE",
  storeId: string
) {
  try {
    const response = await fetch(targetUrl, {
      method,
      headers: buildHeaders(storeId),
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    let data: unknown = raw;

    if (contentType.includes("application/json")) {
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw;
      }
    }

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        data,
      },
      {
        status: response.status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan pada server.";

    return jsonError(message, 500);
  }
}

/**
 * GET
 * /api/pricetag?action=get_lprice&storeId=M604
 *
 * Forward ke:
 * GET .../get_lprice/?storeId=M604
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action") || "get_lprice";
  const storeId =
    searchParams.get("storeId") ||
    searchParams.get("storeid") ||
    searchParams.get("store");

  if (!storeId) {
    return jsonError("storeId wajib diisi.");
  }

  if (action !== "get_lprice") {
    return jsonError("Action GET tidak dikenal.");
  }

  const target = new URL(`${BASE_URL}/get_lprice/`);
  target.searchParams.set("storeId", storeId);

  return forward(target.toString(), "GET", storeId);
}

/**
 * DELETE
 *
 * Hapus PLU:
 * /api/pricetag?action=delete_plu&storeId=M604&plu=454318&rack=AU5
 *
 * Hapus PLU tanpa rack:
 * /api/pricetag?action=delete_plu&storeId=M604&plu=428695&rack=
 *
 * Clear semua:
 * /api/pricetag?action=clear_lprice&storeId=M604
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action");
  const storeId =
    searchParams.get("storeId") ||
    searchParams.get("storeid") ||
    searchParams.get("store");

  if (!storeId) {
    return jsonError("storeId wajib diisi.");
  }

  if (action === "delete_plu") {
    const plu = searchParams.get("plu");
    const rack = searchParams.get("rack") ?? "";

    if (!plu) {
      return jsonError("plu wajib diisi untuk delete_plu.");
    }

    const target = new URL(`${BASE_URL}/delete_plu/`);
    target.searchParams.set("storeid", storeId);
    target.searchParams.set("plu", plu);
    target.searchParams.set("rack", rack);

    return forward(target.toString(), "DELETE", storeId);
  }

  if (action === "clear_lprice") {
    const target = new URL(`${BASE_URL}/clear_lprice/`);
    target.searchParams.set("storeid", storeId);

    return forward(target.toString(), "DELETE", storeId);
  }

  return jsonError(
    "Action DELETE wajib: delete_plu atau clear_lprice."
  );
}

/**
 * POST
 * /api/pricetag?action=check_scan&storeId=M604&barcode=8710103910732&region=1
 *
 * Forward ke:
 * POST .../check_scan/?storeid=M604&barcode=...&region=1
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const action = searchParams.get("action") || "check_scan";
  const storeId =
    searchParams.get("storeId") ||
    searchParams.get("storeid") ||
    searchParams.get("store");
  const barcode = searchParams.get("barcode");
  const region = searchParams.get("region") || "1";

  if (action !== "check_scan") {
    return jsonError("Action POST tidak dikenal.");
  }

  if (!storeId) {
    return jsonError("storeId wajib diisi.");
  }

  if (!barcode) {
    return jsonError("barcode wajib diisi.");
  }

  const target = new URL(`${BASE_URL}/check_scan/`);
  target.searchParams.set("storeid", storeId);
  target.searchParams.set("barcode", barcode);
  target.searchParams.set("region", region);

  return forward(target.toString(), "POST", storeId);
}
