import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function buildHeaders(storeId: string): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",

    "App-Name": env("ALFA_APP_NAME", "LPB-CLOUD"),
    "Version-App": env("ALFA_VERSION_APP"),
    "Version-Code": env("ALFA_VERSION_CODE"),

    "App-Uid": env("ALFA_APP_UID"),
    "Api-Key": env("ALFA_API_KEY"),

    "User-Id": env("ALFA_USER_ID"),

    "Store-Id": storeId,
    "Store-Id-Ext": env("ALFA_STORE_ID_EXT"),

    "AndroidId": env(
      "ALFA_ANDROID_ID",
      env("ALFA_MAC_ADDR")
    ),

    "Mac-Addr": env("ALFA_MAC_ADDR"),
    "Sn": env("ALFA_SN"),

    "Ip-Addr": env(
      "ALFA_IP_ADDR",
      "10.1.10.1"
    ),

    "Branch-Id": env("ALFA_BRANCH_ID"),
    "Class-Store": env("ALFA_CLASS_STORE"),

    "Company-Id": env("ALFA_COMPANY_ID"),
    "Company-Ext": env("ALFA_COMPANY_EXT"),

    "Shard-Id": env("ALFA_SHARD_ID"),

    Platform: env(
      "ALFA_PLATFORM",
      "ANDROID"
    ),

    "Cache-Control": "no-cache",
  };
}

async function readResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleRequest(request: NextRequest) {
  try {
    /*
     * Bisa dipanggil:
     *
     * GET
     * /api/get-jadwal?storeId=M604
     *
     * atau:
     *
     * POST
     * /api/get-jadwal?storeId=M604
     */

    const queryStoreId =
      request.nextUrl.searchParams
        .get("storeId")
        ?.trim() || "";

    let requestBody: Record<string, unknown> = {};

    /*
     * Hanya baca body kalau request dari client adalah POST.
     * GET browser biasanya tidak mempunyai body.
     */
    if (request.method === "POST") {
      try {
        const text = await request.text();

        if (text.trim()) {
          const parsed = JSON.parse(text);

          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            requestBody = parsed;
          }
        }
      } catch {
        requestBody = {};
      }
    }

    const bodyStoreId =
      typeof requestBody.storeId === "string"
        ? requestBody.storeId.trim()
        : "";

    const storeId =
      queryStoreId ||
      bodyStoreId ||
      env("ALFA_STORE_ID");

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId wajib diisi",
          contoh:
            "/api/get-jadwal?storeId=M604",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Endpoint AlfaStore asli.
     *
     * Jangan isi /api/get-jadwal di sini.
     * Ini harus URL endpoint AlfaStore yang memang menerima POST.
     */
    const alfaUrl = env("ALFA_JADWAL_URL");

    if (!alfaUrl) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Environment variable ALFA_JADWAL_URL belum diisi",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Environment variable yang benar-benar penting.
     */
    const requiredEnv = [
      "ALFA_API_KEY",
      "ALFA_APP_UID",
      "ALFA_USER_ID",
    ];

    const missingEnv = requiredEnv.filter(
      (name) => !env(name)
    );

    if (missingEnv.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Konfigurasi AlfaStore belum lengkap",
          missing: missingEnv,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Payload menuju AlfaStore.
     *
     * Walaupun route kita dipanggil pakai GET dari browser,
     * request dari Vercel -> AlfaStore tetap POST.
     */
    const alfaBody = {
      ...requestBody,
      storeId,
    };

    console.log("[GET-JADWAL] upstream request", {
      url: alfaUrl,
      method: "POST",
      storeId,
    });

    const response = await fetch(alfaUrl, {
      method: "POST",
      headers: buildHeaders(storeId),
      body: JSON.stringify(alfaBody),
      cache: "no-store",
      redirect: "follow",
    });

    const data = await readResponse(response);

    console.log("[GET-JADWAL] upstream response", {
      status: response.status,
      statusText: response.statusText,
      contentType:
        response.headers.get("content-type"),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          statusText: response.statusText,
          upstreamUrl: alfaUrl,
          response: data,
        },
        {
          status: response.status,
        }
      );
    }

    /*
     * Kalau AlfaStore sudah mengembalikan JSON,
     * kembalikan hasilnya.
     */
    return NextResponse.json(
      {
        success: true,
        storeId,
        data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[GET-JADWAL] server error",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * Bisa dibuka langsung dari browser.
 *
 * Browser:
 * GET /api/get-jadwal?storeId=M604
 *
 * Tetapi AlfaStore tetap dipanggil menggunakan POST.
 */
export async function GET(
  request: NextRequest
) {
  return handleRequest(request);
}

/*
 * Tetap menerima POST juga.
 */
export async function POST(
  request: NextRequest
) {
  return handleRequest(request);
}
