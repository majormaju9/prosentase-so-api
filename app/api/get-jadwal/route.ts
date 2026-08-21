import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const beginDate = searchParams.get("beginDate");
    const endDate = searchParams.get("endDate");


    if (!storeId || !beginDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "storeId, beginDate, dan endDate wajib diisi",
        },
        {
          status: 400,
        }
      );
    }


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&beginDate=${encodeURIComponent(beginDate)}` +
      `&endDate=${encodeURIComponent(endDate)}`;


    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",

        "App-Name": "CEXP-CLOUD",
        "App-Uid": "10365",

        "Api-Key":
          "ivOZX9MLmKrj1L8R23uFlaryMR1vGMXG",

        "Branch-Id": "MZ01",
        "Store-Id": storeId,

        "Platform": "ANDROID",
        "Version-App": "2025.05.20.1",
        "Version-Code": "9",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; Android 15)",
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
          url: apiUrl,
          response: resultText,
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
        storeId,
        beginDate,
        endDate,
        data,
      },
      {
        status: 200,
      }
    );


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
