import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// WAJIB isi dengan endpoint JADWAL AlfaStore yang benar di Vercel
// Contoh:
// ALFA_JADWAL_URL=https://app.alfastore.co.id/prd/api/xxxxx
const ALFASTORE_URL = process.env.ALFA_JADWAL_URL?.trim() || "";

function getEnv(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function buildAlfaHeaders(storeId: string): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",

    // Header aplikasi AlfaStore
    "App-Name": getEnv("ALFA_APP_NAME", "LPB-CLOUD"),
    "Version-App": getEnv("ALFA_VERSION_APP"),
    "Version-Code": getEnv("ALFA_VERSION_CODE"),

    "App-Uid": getEnv("ALFA_APP_UID"),
    "Api-Key": getEnv("ALFA_API_KEY"),

    // User / toko
    "User-Id": getEnv("ALFA_USER_ID"),
    "Store-Id": storeId,
    "Store-Id-Ext": getEnv("ALFA_STORE_ID_EXT"),

    // Device
    "AndroidId": getEnv(
      "ALFA_ANDROID_ID",
      getEnv("ALFA_MAC_ADDR")
    ),
    "Mac-Addr": getEnv("ALFA_MAC_ADDR"),
    Sn: getEnv("ALFA_SN"),
    "Ip-Addr": getEnv("ALFA_IP_ADDR", "10.1.10.1"),

    // Organisasi
    "Branch-Id": getEnv("ALFA_BRANCH_ID"),
    "Class-Store": getEnv("ALFA_CLASS_STORE"),
    "Company-Id": getEnv("ALFA_COMPANY_ID"),
    "Company-Ext": getEnv("ALFA_COMPANY_EXT"),
    "Shard-Id": getEnv("ALFA_SHARD_ID"),

    Platform: getEnv("ALFA_PLATFORM", "ANDROID"),

    // Hindari cache
    "Cache-Control": "no-cache",
  };
}

async function safeReadResponse(response: Response) {
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

export async function POST(request: NextRequest) {
  try {
    // Bisa:
    // POST /api/get-jadwal?storeId=M604
    const queryStoreId =
      request.nextUrl.searchParams.get("storeId")?.trim();

    // Atau:
    // POST /api/get-jadwal
    // { "storeId": "M604" }
    let body: Record<string, unknown> = {};

    try {
      const rawBody = await request.text();

      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch {
      body = {};
    }

    const bodyStoreId =
      typeof body.storeId === "string"
        ? body.storeId.trim()
        : "";

    const storeId =
      queryStoreId ||
      bodyStoreId ||
      getEnv("ALFA_STORE_ID");

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

    // Jangan lanjut kalau URL upstream belum diisi
    if (!ALFASTORE_URL) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ALFA_JADWAL_URL belum diatur di Environment Variables Vercel",
        },
        {
          status: 500,
        }
      );
    }

    // Cek env penting
    const requiredEnv = [
      "ALFA_API_KEY",
      "ALFA_APP_UID",
      "ALFA_USER_ID",
    ];

    const missingEnv = requiredEnv.filter(
      (name) => !process.env[name]?.trim()
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
     * Body yang dikirim ke AlfaStore.
     *
     * Semua data tambahan yang dikirim client akan diteruskan,
     * tetapi storeId dipastikan menggunakan store yang sudah
     * ditentukan di atas.
     */
    const alfaBody = {
      ...body,
      storeId,
    };

    console.log("[GET-JADWAL] Request AlfaStore", {
      url: ALFASTORE_URL,
      method: "POST",
      storeId,
    });

    const alfaResponse = await fetch(ALFASTORE_URL, {
      method: "POST",
      headers: buildAlfaHeaders(storeId),
      body: JSON.stringify(alfaBody),
      cache: "no-store",
      redirect: "follow",
    });

    const alfaData =
      await safeReadResponse(alfaResponse);

    console.log("[GET-JADWAL] Response AlfaStore", {
      status: alfaResponse.status,
      ok: alfaResponse.ok,
    });

    if (!alfaResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: alfaResponse.status,
          response: alfaData,
        },
        {
          status: alfaResponse.status,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        storeId,
        data: alfaData,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("[GET-JADWAL] Internal error:", error);

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

// Kalau dibuka langsung dari browser menggunakan GET,
// kasih informasi supaya tidak membingungkan.
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Endpoint ini menggunakan POST, bukan GET",
      contoh:
        "POST /api/get-jadwal?storeId=M604",
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    }
  );
}
