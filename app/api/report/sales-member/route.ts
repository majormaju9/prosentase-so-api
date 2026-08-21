import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_sales_member";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const userId =
      searchParams.get("userId") || "23067884";

    const periode1 =
      searchParams.get("periode1") || "29-04-2026";

    const periode2 =
      searchParams.get("periode2") || "29-04-2026";


    const apiUrl = new URL(ALFASTORE_URL);

    apiUrl.searchParams.set(
      "storeId",
      storeId
    );

    apiUrl.searchParams.set(
      "userId",
      userId
    );

    apiUrl.searchParams.set(
      "periode1",
      periode1
    );

    apiUrl.searchParams.set(
      "periode2",
      periode2
    );


    const response = await fetch(
      apiUrl.toString(),
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; Android 15)",

          "Api-Key":
            process.env.ALFA_API_KEY || "",

          "App-Name":
            "CEXP-CLOUD",

          "App-Uid":
            "10365",

          "Store-Id":
            storeId,

          "User-Id":
            userId,

          "Platform":
            "ANDROID",

          "Version-App":
            "2025.05.20.1",

          "Version-Code":
            "9"
        }
      }
    );


    const text = await response.text();


    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }


    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        source:
          "AlfaStore laporan_sales_member",
        data
      },
      {
        status: response.status
      }
    );


  } catch (error: any) {

    return NextResponse.json(
      {
        success:false,
        message:
          "AlfaStore API error",
        error:
          error.message
      },
      {
        status:500
      }
    );

  }
}
