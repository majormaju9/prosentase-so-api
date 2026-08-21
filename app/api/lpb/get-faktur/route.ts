import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_faktur/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        {
          error: true,
          message: "storeId wajib diisi",
        },
        { status: 400 }
      );
    }

    const url = new URL(ALFASTORE_URL);

    url.searchParams.set("storeId", storeId);


    const apiKey = process.env.ALFA_API_KEY;
    const androidId = process.env.ALFA_ANDROID_ID;
    const userId = process.env.ALFA_USER_ID;
    const branchId = process.env.ALFA_BRANCH_ID;


    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",

      headers: {
        Accept: "*/*",

        "App-Name": "LPB-CLOUD",
        "Version-App": "V.2025.11.25.04",
        "Version-Code": "30",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "User-Id": userId || "",

        "Store-Id": storeId,

        "Api-Key": apiKey || "",

        AndroidId: androidId || "",

        "Branch-Id": branchId || "",

        Platform: "ANDROID",

        "Mac-Addr": androidId || "",

        "Ip-Addr": "10.1.10.1",

        "App-Uid": "",
        "Store-Id-Ext": "",
        "Shard-Id": "",
        "Class-Store": "",
        "Company-Id": "",
        "Company-Ext": "",
        Sn: "",
      },
    });


    const result = await response.text();


    console.log("============================");
    console.log("GET FAKTUR URL:", url.toString());
    console.log("STATUS:", response.status);
    console.log(result);
    console.log("============================");


    return new NextResponse(result, {
      status: response.status,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",

        "Cache-Control": "no-store",
      },
    });


  } catch (error) {

    console.error("GET FAKTUR ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Gagal mengambil data faktur",
      },
      {
        status: 500,
      }
    );
  }
}
