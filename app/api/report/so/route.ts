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
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}`;

    console.log("GET JADWAL URL:", apiUrl);

    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        "App-Name": "CEXP-CLOUD",
        Accept: "application/json",
      },

      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          response: responseText,
        },
        {
          status: response.status,
        }
      );
    }

    // Coba parse response AlfaStore sebagai JSON
    try {
      const data = JSON.parse(responseText);

      return NextResponse.json(data);
    } catch {
      // Jika ternyata response bukan JSON
      return new NextResponse(responseText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
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
