import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId =
      searchParams.get("storeId");

    const beginDate =
      searchParams.get("beginDate");

    const endDate =
      searchParams.get("endDate");


    if (!storeId || !beginDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "storeId, beginDate dan endDate wajib diisi",
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
        "Content-Type": "application/json",
        "Accept": "application/json",

        "Api-Key":
          process.env.ALFA_API_KEY ||
          "ivOZX9MLmKrj1L8R23uFlaryMR1vGMXG",

        "App-Name": "CEXP-CLOUD",

        "App-Uid":
          process.env.ALFA_APP_UID ||
          "10365",

        "Branch-Id":
          process.env.ALFA_BRANCH_ID ||
          "MZ01",

        "Company-Id": "SAT",

        "Ip-Addr": "0.0.0.0",

        "Mac-Addr":
          process.env.ALFA_MAC_ADDR ||
          "712f8db18eeb1816",

        "Platform": "ANDROID",

        "Shard-Id": "Sn",

        "Store-Id": storeId,

        "User-Id":
          process.env.ALFA_USER_ID ||
          "23067884",

        "Version-App": "2025.05.20.1",

        "Version-Code": "9",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
      },

      cache: "no-store",
    });


    const text =
      await response.text();


    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          data: text,
        },
        {
          status: response.status,
        }
      );
    }


    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }


    return NextResponse.json({
      success: true,
      data,
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
