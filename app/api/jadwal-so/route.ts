import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/utility/so/get_jadwal/";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const date =
      searchParams.get("date") || "19/08/2026";


    const response = await fetch(
      ALFASTORE_URL,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "Accept":
            "application/json",

          "App-Name":
            "PDA",

          "Api-Key":
            "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

          "Version-App":
            "2024.11.12.09",

          "Store-Id":
            storeId,

          "User-Id":
            "23067884",

          "Mac-Addr":
            "712f8db18eeb1816",

          "AndroidId":
            "712f8db18eeb1816",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)"

        },


        body: JSON.stringify({

          storeId,

          date

        }),


        cache:
          "no-store"

      }
    );


    const text =
      await response.text();


    let data;


    try {

      data = JSON.parse(text);

    } catch {

      data = {
        html:text
      };

    }



    if (!response.ok) {

      return NextResponse.json(
        {

          success:false,

          message:
            "AlfaStore API error",

          status:
            response.status,

          data

        },
        {
          status:response.status
        }
      );

    }



    return NextResponse.json(
      {

        success:true,

        source:
          "PDA",

        endpoint:
          "sis/utility/so/get_jadwal",

        request:{

          storeId,

          date

        },

        data

      }
    );



  } catch(error) {


    return NextResponse.json(
      {

        success:false,

        message:
          error instanceof Error
          ? error.message
          : String(error)

      },
      {
        status:500
      }
    );

  }

}
