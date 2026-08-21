import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/posisi_LPMP_rupiah_per_dept";


export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const userId =
      searchParams.get("userId") || "23067884";

    const periode1 =
      searchParams.get("periode1") || "04-08-2026";

    const periode2 =
      searchParams.get("periode2") || "04-08-2026";


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

          "Accept": "*/*",

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
            "9",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; Android 15)"
        }
      }
    );


    const html =
      await response.text();


    // Return HTML asli AlfaStore
    // tanpa perubahan tabel / CSS / struktur

    return new NextResponse(
      html,
      {
        status: response.status,

        headers:{
          "Content-Type":
            "text/html; charset=utf-8"
        }
      }
    );


  } catch(error:any){

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
