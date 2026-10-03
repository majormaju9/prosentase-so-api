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

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { success: false, message, ...extra },
    { status, headers: CORS_HEADERS }
  );
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Environment variable ${name} belum diisi`);
  }
  return value;
}

/*
  Header sensitif tetap disimpan di environment variable server.

  WAJIB:
  ALFA_API_KEY
  ALFA_USER_ID
  ALFA_ANDROID_ID

  OPSIONAL:
  ALFA_MAC_ADDR
  ALFA_BRANCH_ID
  ALFA_IP_ADDR
  ALFA_VERSION_APP
  ALFA_VERSION_CODE
  ALFA_USER_AGENT
*/
function buildHeaders(storeId: string, jsonBody = false): HeadersInit {
  const androidId = requireEnv("ALFA_ANDROID_ID");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "App-Name": "SO-PDA",
    "User-Agent":
      process.env.ALFA_USER_AGENT ||
      "Dalvik/2.1.0 (Linux; U; Android 15)",
    "Version-App":
      process.env.ALFA_VERSION_APP ||
      "V.2026.04.13.01-alfa",
    "Version-Code":
      process.env.ALFA_VERSION_CODE ||
      "28",
    "User-Id": requireEnv("ALFA_USER_ID"),
    "Store-Id": storeId,
    "Ip-Addr":
      process.env.ALFA_IP_ADDR ||
      "10.1.10.1",
    "Api-Key": requireEnv("ALFA_API_KEY"),
    AndroidId: androidId,
    "Branch-Id":
      process.env.ALFA_BRANCH_ID ||
      "MZ01",
    Platform: "ANDROID",
    "Mac-Addr":
      process.env.ALFA_MAC_ADDR ||
      androidId,
    Connection: "Keep-Alive",
    "Accept-Encoding": "gzip",
  };

  if (jsonBody) {
    headers["Content-Type"] = "application/json; charset=utf-8";
  }

  return headers;
}

/*
  Terima dua format:
  - 03-10-2026
  - 2026-10-03

  Upstream ALFASTORE menerima DD-MM-YYYY.
*/
function toApiDate(value: unknown): string {
  const raw = String(value ?? "").trim();

  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    return raw;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}-${m}-${y}`;
  }

  throw new Error(
    "Format tanggal tidak valid. Gunakan YYYY-MM-DD atau DD-MM-YYYY."
  );
}

function normalizeStore(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function proxyResponse(response: Response) {
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type":
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

/*
  FRONTEND BOLEH KIRIM FORMAT SEPERTI INI:

  {
    "kodeToko": "M604",
    "dateSo": "2026-10-03",
    "data": [
      {
        "avg_cost": "0",
        "barcode": "899886620289",
        "date": "2026-10-03",
        "f_tag": "0",
        "item_descp": "GOLDA CAPPUCCINO PET 200ML",
        "plu": "432393",
        "qty": 1,
        "resetQty": false,
        "rack": "AU5",
        "tag": "F"
      }
    ]
  }

  Route akan mengubahnya menjadi format upstream:

  {
    "kodeToko": "M604",
    "dateSo": "03-10-2026",
    "rakSo": "AU5",
    "data": [
      {
        "plu": 432393,
        "descp": "GOLDA CAPPUCCINO PET 200ML",
        "conv1": 0,
        "conv2": 0,
        "subdept": 0,
        "barcode": "899886620289",
        "tag": "F",
        "qty": "1",
        "avg_cost": 0
      }
    ]
  }
*/
function transformSaveBody(input: any) {
  const kodeToko = normalizeStore(
    input?.kodeToko ||
    input?.storeId ||
    input?.storeIdHeader
  );

  if (!kodeToko) {
    throw new Error("kodeToko wajib diisi");
  }

  const dateSo = toApiDate(
    input?.dateSo ||
    input?.date
  );

  const sourceData = Array.isArray(input?.data)
    ? input.data
    : [];

  if (sourceData.length === 0) {
    throw new Error("data minimal harus berisi 1 item");
  }

  const rakSo = String(
    input?.rakSo ||
    input?.rack ||
    sourceData[0]?.rakSo ||
    sourceData[0]?.rack ||
    ""
  ).trim();

  if (!rakSo) {
    throw new Error(
      "rakSo/rack tidak ditemukan. Isi rakSo di body atau rack pada data item."
    );
  }

  const data = sourceData.map((item: any) => {
    const pluRaw =
      item?.plu ??
      item?.PLU ??
      item?.article_code ??
      "";

    const pluNumber = Number(pluRaw);

    return {
      plu: Number.isFinite(pluNumber)
        ? pluNumber
        : pluRaw,

      descp: String(
        item?.descp ??
        item?.item_descp ??
        item?.description ??
        item?.nama ??
        ""
      ),

      conv1: normalizeNumber(item?.conv1, 0),
      conv2: normalizeNumber(item?.conv2, 0),
      subdept: normalizeNumber(item?.subdept, 0),

      barcode: String(
        item?.barcode ??
        item?.barcode_no ??
        "0"
      ),

      tag: String(
        item?.tag ??
        item?.f_tag ??
        ""
      ),

      // Referensi request native mengirim qty sebagai string.
      qty: String(
        item?.resetQty === true
          ? 0
          : normalizeNumber(item?.qty, 0)
      ),

      avg_cost: normalizeNumber(
        item?.avg_cost,
        0
      ),
    };
  });

  return {
    kodeToko,
    dateSo,
    rakSo,
    data,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Jika route dibuka langsung tanpa query parameter, jangan dianggap error.
    // Tampilkan status route + format pemakaian.
    if ([...searchParams.keys()].length === 0) {
      return NextResponse.json({
        success: true,
        message: "ENTRY KKSO proxy siap digunakan",
        endpoints: {
          rack: "?type=rack&storeId=M604&date=03-10-2026",
          data: "?type=item&storeId=M604&date=03-10-2026&rack=AU5",
          saveEntry: "POST ?type=save",
          savePerItem: "POST ?type=save-item"
        }
      }, { headers: CORS_HEADERS });
    }

    let action = (
      searchParams.get("action") ||
      searchParams.get("type") ||
      ""
    ).toLowerCase();

    /*
      action opsional:
      - ada rack/rakSo => data
      - tanpa rack => rack
    */
    if (!action) {
      const hasRack = Boolean(
        (
          searchParams.get("rakSo") ||
          searchParams.get("rack") ||
          ""
        ).trim()
      );

      const hasStore = Boolean(
        (
          searchParams.get("storeId") ||
          searchParams.get("kodeToko") ||
          ""
        ).trim()
      );

      const hasDate = Boolean(
        (
          searchParams.get("dateSo") ||
          searchParams.get("date") ||
          ""
        ).trim()
      );

      if (hasRack && hasStore && hasDate) {
        action = "data";
      } else if (hasStore && hasDate) {
        action = "rack";
      }
    }

    if (
      action === "rack" ||
      action === "get_rak_tx_stentry"
    ) {
      const storeId = normalizeStore(
        searchParams.get("storeId") ||
        searchParams.get("kodeToko")
      );

      if (!storeId) {
        return jsonError("storeId wajib diisi");
      }

      const dateSo = toApiDate(
        searchParams.get("dateSo") ||
        searchParams.get("date")
      );

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

    if (
      action === "data" ||
      action === "item" ||
      action === "get_data_entry"
    ) {
      const kodeToko = normalizeStore(
        searchParams.get("kodeToko") ||
        searchParams.get("storeId")
      );

      if (!kodeToko) {
        return jsonError("kodeToko wajib diisi");
      }

      const dateSo = toApiDate(
        searchParams.get("dateSo") ||
        searchParams.get("date")
      );

      const rakSo = String(
        searchParams.get("rakSo") ||
        searchParams.get("rack") ||
        ""
      ).trim();

      if (!rakSo) {
        return jsonError("rakSo/rack wajib diisi");
      }

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
      "Parameter GET belum lengkap.",
      400,
      {
        contohRack:
          "?type=rack&storeId=M604&date=03-10-2026",
        contohData:
          "?type=item&storeId=M604&date=03-10-2026&rack=AU5",
        alternatifRack:
          "?storeId=M604&dateSo=2026-10-03",
        alternatifData:
          "?kodeToko=M604&dateSo=2026-10-03&rakSo=AU5"
      }
    );
  } catch (error) {
    console.error("ENTRY KKSO GET ERROR:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan server",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    /*
      Default POST = save_entry_kkso.
      Jadi frontend lama tidak wajib menambah ?action=save-entry.

      Untuk save_per_item:
      ?action=save-item
    */
    const action = (
      searchParams.get("action") ||
      searchParams.get("type") ||
      "save-entry"
    ).toLowerCase();

    const rawBody = await req.json();

    // Transform body frontend -> format native upstream.
    const body = transformSaveBody(rawBody);

    let endpoint: string;

    if (
      action === "save" ||
      action === "save-entry" ||
      action === "save_entry" ||
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
        'Action POST tidak dikenal. Gunakan "?action=save-entry" atau "?action=save-item".'
      );
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: buildHeaders(
        body.kodeToko,
        true
      ),
      body: JSON.stringify(body),
      cache: "no-store",
    });

    return proxyResponse(upstream);
  } catch (error) {
    console.error("ENTRY KKSO POST ERROR:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan server",
      500
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      Allow: "GET, POST, OPTIONS",
    },
  });
}

/*
===========================================================
CONTOH PAKAI
===========================================================

1. GET RACK

/api/entry-kkso?storeId=M604&dateSo=2026-10-03

Akan diteruskan ke:

GET
https://app.alfastore.co.id/prd/api/so/entry_kkso/get_rak_tx_stEntry?storeId=M604&dateSo=03-10-2026


2. GET DATA RACK

/api/entry-kkso?kodeToko=M604&dateSo=2026-10-03&rakSo=AU5

Akan diteruskan ke:

GET
https://app.alfastore.co.id/prd/api/so/entry_kkso/get_data_entry?kodeToko=M604&dateSo=03-10-2026&rakSo=AU5


3. SAVE ENTRY — BODY FRONTEND LAMA TETAP BISA

POST /api/entry-kkso

{
  "kodeToko": "M604",
  "dateSo": "2026-10-03",
  "data": [
    {
      "avg_cost": "0",
      "barcode": "899886620289",
      "date": "2026-10-03",
      "f_tag": "0",
      "item_descp": "GOLDA CAPPUCCINO PET 200ML",
      "plu": "432393",
      "qty": 1,
      "resetQty": false,
      "rack": "AU5",
      "tag": "F"
    }
  ]
}

Route otomatis mengirim upstream:

{
  "kodeToko": "M604",
  "dateSo": "03-10-2026",
  "rakSo": "AU5",
  "data": [
    {
      "plu": 432393,
      "descp": "GOLDA CAPPUCCINO PET 200ML",
      "conv1": 0,
      "conv2": 0,
      "subdept": 0,
      "barcode": "899886620289",
      "tag": "F",
      "qty": "1",
      "avg_cost": 0
    }
  ]
}


4. SAVE PER ITEM

POST /api/entry-kkso?action=save-item

Body boleh tetap memakai format frontend yang sama.
Route akan mentransformasikannya ke format native lalu dikirim ke:

https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item
===========================================================
*/
