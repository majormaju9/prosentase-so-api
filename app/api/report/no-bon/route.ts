import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_penjualan_per_nomor_bon";


export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "1PL8";

    const dateTx =
      searchParams.get("dateTx") || "06-07-2026";

    const userId =
      searchParams.get("userId") || "20061943";


    const apiUrl = new URL(ALFASTORE_URL);

    apiUrl.searchParams.set(
      "storeId",
      storeId
    );

    apiUrl.searchParams.set(
      "dateTx",
      dateTx
    );

    apiUrl.searchParams.set(
      "userId",
      userId
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


    // Mengembalikan HTML asli AlfaStore
    // tanpa modifikasi tabel

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
