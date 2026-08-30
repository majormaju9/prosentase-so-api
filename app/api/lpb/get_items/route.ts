import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/transaksi/lpb/get_items";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const lpbType = searchParams.get("lpbType");
    const noFaktur = searchParams.get("noFaktur");
    const storeDate = searchParams.get("storeDate");

    if (!storeId || !lpbType || !noFaktur || !storeDate) {
      return NextResponse.json(
        {
          error: true,
          message:
            "storeId, lpbType, noFaktur, dan storeDate wajib diisi",
        },
        { status: 400 }
      );
    }

    const upstreamUrl = new URL(ALFASTORE_URL);

    upstreamUrl.searchParams.set("storeId", storeId);
    upstreamUrl.searchParams.set("lpbType", lpbType);
    upstreamUrl.searchParams.set("noFaktur", noFaktur);
    upstreamUrl.searchParams.set("storeDate", storeDate);

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

    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",

      headers: {
        Accept: "*/*",

        "App-Name": "LPB-CLOUD",
        "Version-App": "V.2025.11.25.04",
        "Version-Code": "30",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "App-Uid": "",

        "User-Id": userId,

        // Sama dengan query storeId
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
    });

    const body = await response.text();

    console.log("====================================");
    console.log("ALFA URL:", upstreamUrl.toString());
    console.log("ALFA STATUS:", response.status);
    console.log(
      "ALFA CONTENT TYPE:",
      response.headers.get("content-type")
    );
    console.log("ALFA BODY:", body);
    console.log("====================================");

    return new NextResponse(body, {
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
    console.error("ALFASTORE LPB GET ITEMS ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Gagal mengambil data LPB get_items",
      },
      { status: 500 }
    );
  }
}
