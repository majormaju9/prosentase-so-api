import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/TotalFaktur/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const faktur = searchParams.get("faktur");

    if (!storeId || !faktur) {
      return NextResponse.json(
        {
          error: true,
          message: "storeId dan faktur wajib diisi",
        },
        { status: 400 }
      );
    }

    const upstreamUrl = new URL(ALFASTORE_URL);

    upstreamUrl.searchParams.set("storeId", storeId);
    upstreamUrl.searchParams.set("faktur", faktur);

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

        // Harus sama dengan query storeId
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

    // Debug hanya di server
    console.log("====================================");
    console.log("ALFA URL:", upstreamUrl.toString());
    console.log("ALFA STATUS:", response.status);
    console.log("ALFA CONTENT TYPE:", response.headers.get("content-type"));
    console.log("ALFA BODY:", body);
    console.log("====================================");

    // Teruskan response asli
    return new NextResponse(body, {
      status: response.status,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",

        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("TOTAL FAKTUR ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Gagal mengambil TotalFaktur dari AlfaStore",
      },
      { status: 500 }
    );
  }
}
