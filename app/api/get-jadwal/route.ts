import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId wajib diisi",
        },
        { status: 400 }
      );
    }

    const apiUrl =
      `${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "App-Name": "CEXP-CLOUD",
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });

    const result = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          data: result,
        },
        { status: response.status }
      );
    }

    // Kalau response AlfaStore berupa JSON,
    // kembalikan sebagai JSON asli.
    try {
      const json = JSON.parse(result);

      return NextResponse.json(json, {
        headers: {
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Kalau ternyata bukan JSON
      return new Response(result, {
        status: 200,
        headers: {
          "Content-Type":
            response.headers.get("content-type") ||
            "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("GET JADWAL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil jadwal AlfaStore",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
