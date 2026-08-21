import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/rpt_100_top_item";


export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "L257";

    const dateSys =
      searchParams.get("date_sys") || "22-05-2026";


    const apiUrl = new URL(ALFASTORE_URL);

    apiUrl.searchParams.set(
      "storeId",
      storeId
    );

    apiUrl.searchParams.set(
      "date_sys",
      dateSys
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
