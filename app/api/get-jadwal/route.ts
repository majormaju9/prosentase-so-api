import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";

export const dynamic = "force-dynamic";

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

    const upstream = new URL(ALFASTORE_URL);
    upstream.searchParams.set("storeId", storeId);

    const response = await fetch(upstream.toString(), {
      method: "GET",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",

        "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "App-Name": "CEXP-CLOUD",
        "App-Uid": "10365",

        "Branch-Id": "MZ01",
        "Class-Store": "A",

        "Company-Ext": "",
        "Company-Id": "SAT",

        "Ip-Addr": "0.0.0.0",

        "Mac-Addr": "712f8db18eeb1816",

        Platform: "ANDROID",

        "Shard-Id": "",

        Sn: "712f8db18eeb1816",

        "Store-Id": storeId,
        "Store-Id-Ext": "",

        "User-Id": "23067884",

        "Version-App": "2025.05.20.1",
        "Version-Code": "9",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
      },

      cache: "no-store",
      redirect: "follow",
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/json";

    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil jadwal",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
