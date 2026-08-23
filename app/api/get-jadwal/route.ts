import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/utility/so/get_jadwal";


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const date = searchParams.get("date");


    if (!storeId || !date) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId dan date wajib diisi",
        },
        {
          status: 400,
        }
      );
    }


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&date=${encodeURIComponent(date)}`;


    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        "App-Name": "CEXP-CLOUD",
        "User-Agent": "Mozilla/5.0",
      },

      cache: "no-store",
    });


    const contentType = response.headers.get("content-type") || "";

    let data;


    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      data = {
        html: text,
      };
    }


    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          data,
        },
        {
          status: response.status,
        }
      );
    }


    return NextResponse.json({
      success: true,
      source: "AlfaStore",
      endpoint: "get_jadwal",
      parameter: {
        storeId,
        date,
      },
      data,
    });


  } catch (error) {

    console.error("GET JADWAL ERROR:", error);


    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil jadwal SO AlfaStore",
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
