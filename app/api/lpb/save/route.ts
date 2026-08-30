import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/transaksi/lpb/save";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // storeId bisa diambil dari body atau query
    const { searchParams } = new URL(request.url);

    const storeId =
      body?.storeId ||
      body?.StoreId ||
      searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        {
          error: true,
          message: "storeId wajib diisi",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.ALFA_API_KEY;
    const androidId = process.env.ALFA_ANDROID_ID;
    const userId = process.env.ALFA_USER_ID;
    const branchId = process.env.ALFA_BRANCH_ID;

    if (!apiKey || !androidId || !userId || !branchId) {
      return NextResponse.json(
        {
          error: true,
          message: "Konfigurasi AlfaStore belum lengkap",
        },
        { status: 500 }
      );
    }

    const response = await fetch(ALFASTORE_URL, {
      method: "POST",
      cache: "no-store",

      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",

        "App-Name": "LPB-CLOUD",
        "Version-App": "V.2025.11.25.04",
        "Version-Code": "30",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "App-Uid": "",

        "User-Id": userId,

        // Sama dengan storeId request
        "Store-Id": storeId,

        "Store-Id-Ext": "",
        "Shard-Id": "",

        "Ip-Addr": "10.1.10.1",

        Sn: "",

        "Api-Key": apiKey,

        AndroidId: androidId,

        "Branch-Id": branchId,

        "Class-Store": "",

        "Company-Id": "",
        "Company-Ext": "",

        Platform: "ANDROID",

        "Mac-Addr": androidId,
      },

      body: JSON.stringify(body),
    });

    const responseBody = await response.text();

    // Debug hanya di server
    console.log("====================================");
    console.log("ALFA URL:", ALFASTORE_URL);
    console.log("ALFA METHOD: POST");
    console.log("ALFA STORE ID:", storeId);
    console.log("ALFA REQUEST BODY:", body);
    console.log("ALFA STATUS:", response.status);
    console.log(
      "ALFA CONTENT TYPE:",
      response.headers.get("content-type")
    );
    console.log("ALFA RESPONSE:", responseBody);
    console.log("====================================");

    return new NextResponse(responseBody, {
      status: response.status,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("ALFASTORE LPB SAVE ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Gagal menyimpan data LPB",
      },
      { status: 500 }
    );
  }
}
