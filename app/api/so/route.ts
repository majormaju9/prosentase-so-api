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
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0",
      },

      cache: "no-store",

    });


    const resultText = await response.text();


    if (!response.ok) {

      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          endpoint: apiUrl,
          data: resultText,
        },
        {
          status: response.status,
        }
      );

    }


    let data;

    try {
      data = JSON.parse(resultText);
    } catch {
      data = resultText;
    }


    return NextResponse.json(
      {
        success: true,
        endpoint: "sis_utility_so_get_jadwal",
        storeId,
        date,
        data,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error("JADWAL SO ERROR:", error);


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
