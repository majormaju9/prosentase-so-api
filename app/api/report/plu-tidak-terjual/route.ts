import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_plu_yang_tidak_terjual";


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
      searchParams.get("periode2") || "22-08-2026";


    const url = new URL(ALFASTORE_URL);


    url.searchParams.set("storeId", storeId);
    url.searchParams.set("userId", userId);
    url.searchParams.set("periode1", periode1);
    url.searchParams.set("periode2", periode2);


    const response = await fetch(url.toString(), {

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

    });


    const result = await response.text();


    return new NextResponse(result, {

      status: response.status,

      headers: {

        "Content-Type":
          "text/html; charset=utf-8"

      }

    });


  } catch(error:any) {

    return NextResponse.json({

      success:false,

      message:"AlfaStore API error",

      error:error.message

    }, {

      status:500

    });

  }

}
