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
        {
          status: 400,
        }
      );
    }


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}`;


    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        "App-Name": "CEXP-CLOUD",
      },

      cache: "no-store",
    });


    const contentType = response.headers.get(
      "content-type"
    );


    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          data: errorText,
        },
        {
          status: response.status,
        }
      );
    }


    // Jika response JSON
    if (
      contentType &&
      contentType.includes("application/json")
    ) {
      const json = await response.json();

      return NextResponse.json({
        success: true,
        data: json,
      });
    }


    // Jika response bukan JSON
    const text = await response.text();

    return NextResponse.json({
      success: true,
      data: text,
    });


  } catch (error) {

    console.error(
      "GET JADWAL ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil jadwal AlfaStore",
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
