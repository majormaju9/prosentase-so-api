import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_posisi_mutasi_per_plu";


export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const periode1 =
      searchParams.get("periode1") || "2026-07-21";

    const periode2 =
      searchParams.get("periode2") || "2026-07-21";

    const plu =
      searchParams.get("plu") || "244";


    const apiUrl = new URL(ALFASTORE_URL);

    apiUrl.searchParams.set(
      "storeId",
      storeId
    );

    apiUrl.searchParams.set(
      "periode1",
      periode1
    );

    apiUrl.searchParams.set(
      "periode2",
      periode2
    );

    apiUrl.searchParams.set(
      "plu",
      plu
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
    // tanpa perubahan tabel, style, maupun struktur

    return new NextResponse(
      html,
      {
        status: response.status,

        headers: {
          "Content-Type":
            "text/html; charset=utf-8"
        }
      }
    );


  } catch (error:any) {

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
