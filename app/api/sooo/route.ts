import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://app.alfastore.co.id/prd/api/so/entry_kkso";

const ENDPOINTS = {
  rack: `${BASE_URL}/get_rak_tx_stEntry`,
  data: `${BASE_URL}/get_data_entry`,
  saveEntry: `${BASE_URL}/save_entry_kkso`,
  saveItem: `${BASE_URL}/save_per_item`,
} as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Environment variable ${name} belum diisi`);
  return value;
}

/**
 * Header mengikuti pola request aplikasi pada referensi.
 * Data yang bersifat credential/device-specific disimpan di environment variable,
 * supaya tidak ikut bocor di source code / browser.
 *
 * Contoh environment variable yang perlu disiapkan:
 * ALFA_API_KEY=...
 * ALFA_USER_ID=...
 * ALFA_ANDROID_ID=...
 * ALFA_MAC_ADDR=...
 *
 * Opsional:
 * ALFA_BRANCH_ID=MZ01
 * ALFA_IP_ADDR=10.1.10.1
 * ALFA_VERSION_APP=V.2026.04.13.01-alfa
 * ALFA_VERSION_CODE=28
 */
function buildHeaders(storeId: string, hasJsonBody = false): HeadersInit {
  const androidId = requireEnv("ALFA_ANDROID_ID");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "App-Name": "SO-PDA",
    "User-Agent":
      process.env.ALFA_USER_AGENT ||
      "Dalvik/2.1.0 (Linux; U; Android 15)",
    "Version-App":
      process.env.ALFA_VERSION_APP || "V.2026.04.13.01-alfa",
    "Version-Code":
      process.env.ALFA_VERSION_CODE || "28",
    "User-Id": requireEnv("ALFA_USER_ID"),
    "Store-Id": storeId,
    "Ip-Addr": process.env.ALFA_IP_ADDR || "10.1.10.1",
    "Api-Key": requireEnv("ALFA_API_KEY"),
    AndroidId: androidId,
    "Branch-Id": process.env.ALFA_BRANCH_ID || "MZ01",
    Platform: "ANDROID",
    "Mac-Addr": process.env.ALFA_MAC_ADDR || androidId,
    Connection: "Keep-Alive",
    "Accept-Encoding": "gzip",
  };

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }

  return headers;
}

async function proxyResponse(response: Response) {
  const body = await response.text();

  const contentType =
    response.headers.get("content-type") || "application/json; charset=utf-8";

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function normalizeDate(dateSo: string) {
  // Endpoint referensi menggunakan DD-MM-YYYY.
  if (!/^\d{2}-\d{2}-\d{4}$/.test(dateSo)) {
    throw new Error("dateSo harus format DD-MM-YYYY, contoh 08-09-2026");
  }
  return dateSo;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = (searchParams.get("action") || "").toLowerCase();

    if (action === "rack") {
      const storeId = (searchParams.get("storeId") || "").trim().toUpperCase();
      const dateSo = normalizeDate((searchParams.get("dateSo") || "").trim());

      if (!storeId) return jsonError("storeId wajib diisi");

      const url = new URL(ENDPOINTS.rack);
      url.searchParams.set("storeId", storeId);
      url.searchParams.set("dateSo", dateSo);

      const upstream = await fetch(url, {
        method: "GET",
        headers: buildHeaders(storeId),
        cache: "no-store",
      });

      return proxyResponse(upstream);
    }

    if (action === "data") {
      const kodeToko = (
        searchParams.get("kodeToko") ||
        searchParams.get("storeId") ||
        ""
      )
        .trim()
        .toUpperCase();

      const dateSo = normalizeDate((searchParams.get("dateSo") || "").trim());
      const rakSo = (
        searchParams.get("rakSo") ||
        searchParams.get("rack") ||
        ""
      ).trim();

      if (!kodeToko) return jsonError("kodeToko wajib diisi");
      if (!rakSo) return jsonError("rakSo wajib diisi");

      const url = new URL(ENDPOINTS.data);
      url.searchParams.set("kodeToko", kodeToko);
      url.searchParams.set("dateSo", dateSo);
      url.searchParams.set("rakSo", rakSo);

      const upstream = await fetch(url, {
        method: "GET",
        headers: buildHeaders(kodeToko),
        cache: "no-store",
      });

      return proxyResponse(upstream);
    }

    return jsonError(
      'action GET tidak dikenal. Gunakan "?action=rack" atau "?action=data".'
    );
  } catch (error) {
    console.error("ENTRY KKSO GET ERROR:", error);
    return jsonError(
      error instanceof Error ? error.message : "Terjadi kesalahan server",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = (searchParams.get("action") || "").toLowerCase();

    const body = await req.json();

    const kodeToko = String(
      body?.kodeToko ||
      body?.storeId ||
      body?.storeIdHeader ||
      ""
    )
      .trim()
      .toUpperCase();

    if (!kodeToko) return jsonError("kodeToko pada body wajib diisi");

    if (body?.dateSo) {
      normalizeDate(String(body.dateSo));
    }

    let endpoint: string;

    if (
      action === "save" ||
      action === "save-entry" ||
      action === "save_entry_kkso"
    ) {
      endpoint = ENDPOINTS.saveEntry;
    } else if (
      action === "item" ||
      action === "save-item" ||
      action === "save_per_item"
    ) {
      endpoint = ENDPOINTS.saveItem;
    } else {
      return jsonError(
        'action POST tidak dikenal. Gunakan "?action=save-entry" atau "?action=save-item".'
      );
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(kodeToko, true),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return proxyResponse(upstream);
  } catch (error) {
    console.error("ENTRY KKSO POST ERROR:", error);
    return jsonError(
      error instanceof Error ? error.message : "Terjadi kesalahan server",
      500
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}

/*
==========================================================
CONTOH PEMAKAIAN ROUTE INI
==========================================================

1. GET RACK
/api/entry-kkso?action=rack&storeId=M604&dateSo=08-09-2026

Upstream:
GET
https://app.alfastore.co.id/prd/api/so/entry_kkso/get_rak_tx_stEntry?storeId=M604&dateSo=08-09-2026


2. GET DATA ENTRY BERDASARKAN RACK
/api/entry-kkso?action=data&kodeToko=M604&dateSo=04-09-2026&rakSo=AU5

Upstream:
GET
https://app.alfastore.co.id/prd/api/so/entry_kkso/get_data_entry?kodeToko=M604&dateSo=04-09-2026&rakSo=AU5


3. SAVE ENTRY KKSO
POST /api/entry-kkso?action=save-entry
Content-Type: application/json

Contoh body:
{
  "kodeToko": "M604",
  "dateSo": "23-09-2026",
  "rakSo": "HB4",
  "data": [
    {
      "plu": 434889,
      "descp": "SILVER QUEEN CASHEW 3X52G",
      "conv1": 0,
      "conv2": 0,
      "subdept": 0,
      "barcode": "899100166335",
      "tag": "P",
      "qty": "0",
      "avg_cost": 25033.14
    }
  ]
}

Upstream:
POST
https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso


4. SAVE PER ITEM
POST /api/entry-kkso?action=save-item
Content-Type: application/json

Contoh body:
{
  "kodeToko": "M604",
  "dateSo": "29-09-2026",
  "rakSo": "ZR1",
  "data": [
    {
      "plu": 262564,
      "descp": "AQUA AIR MNRL BKL NAS GLN 19L",
      "conv1": 0,
      "conv2": 0,
      "subdept": 0,
      "barcode": "0",
      "tag": "K",
      "qty": "31",
      "avg_cost": 17478
    }
  ]
}

Upstream:
POST
https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item

==========================================================
CATATAN ENVIRONMENT VARIABLE
==========================================================

ALFA_API_KEY=isi_api_key
ALFA_USER_ID=isi_user_id
ALFA_ANDROID_ID=isi_android_id
ALFA_MAC_ADDR=isi_mac_address

Opsional:
ALFA_BRANCH_ID=MZ01
ALFA_IP_ADDR=10.1.10.1
ALFA_VERSION_APP=V.2026.04.13.01-alfa
ALFA_VERSION_CODE=28
ALFA_USER_AGENT=Dalvik/2.1.0 (Linux; U; Android 15)

Simpan credential di environment/server, jangan ditaruh di JavaScript browser.
*/
