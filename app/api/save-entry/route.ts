import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/get_rak_tx_stEntry";


export async function GET(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const dateSo = searchParams.get("dateSo");


    if (!storeId || !dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId dan dateSo wajib diisi",
        },
        {
          status: 400,
        }
      );
    }


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&dateSo=${encodeURIComponent(dateSo)}`;


    const response = await fetch(apiUrl, {

      method: "GET",

      headers: {

        "App-Name": "SO-PDA",

        "Version-App":
          "V.2026.04.13.01-alfa",

        "Version-Code":
          "28",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",

        "Platform":
          "ANDROID",

        "Api-Key":
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",

        "Accept-Encoding":
          "gzip",

        "Connection":
          "Keep-Alive",

        "Host":
          "app.alfastore.co.id",

      },

      cache:
        "no-store",

    });


    const contentType =
      response.headers.get("content-type") || "";


    const text =
      await response.text();


    if (!response.ok) {

      return NextResponse.json(
        {
          success: false,

          message:
            "AlfaStore API error",

          status:
            response.status,

          response:
            text,
        },
        {
          status:
            response.status,
        }
      );

    }


    let result;

    try {

      result =
        JSON.parse(text);

    } catch {

      result =
        text;

    }


    return NextResponse.json({

      success:
        true,

      contentType,

      data:
        result,

    });


  } catch (error) {


    console.error(
      "GET RAK TX ST ENTRY ERROR:",
      error
    );


    return NextResponse.json(

      {
        success:
          false,

        message:
          "Internal server error",

        error:
          String(error),
      },

      {
        status:
          500,
      }

    );

  }

}
