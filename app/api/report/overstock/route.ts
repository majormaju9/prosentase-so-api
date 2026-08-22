import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/rpt_overstock";


export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "L257";

    const date1 =
      searchParams.get("date_1") || "01-08-2026";

    const date2 =
      searchParams.get("date_2") || "04-08-2026";


    const url = new URL(ALFASTORE_URL);

    url.searchParams.set("storeId", storeId);
    url.searchParams.set("date_1", date1);
    url.searchParams.set("date_2", date2);


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
