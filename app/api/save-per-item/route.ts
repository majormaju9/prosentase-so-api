import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";



export async function POST(request: NextRequest) {

  try {


    const body = await request.json();



    if (!body) {

      return NextResponse.json(
        {
          success: false,
          message: "Request body kosong",
        },
        {
          status: 400,
        }
      );

    }



    const response = await fetch(
      ALFASTORE_URL,
      {

        method: "POST",


        headers: {


          "App-Name":
            "SO-PDA",


          "Version-App":
            "V.2026.04.13.01-alfa",


          "Version-Code":
            "28",


          "User-Agent":
            "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


          "App-Uid":
            "",


          "User-Id":
            "23067884",


          "Store-Id":
            "M604",


          "Store-Id-Ext":
            "",


          "Shard-Id":
            "",


          "Ip-Addr":
            "10.1.10.1",


          "Sn":
            "",


          "Api-Key":
            "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",


          "AndroidId":
            "56cb5d6cc7274364",


          "Branch-Id":
            "MZ01",


          "Class-Store":
            "",


          "Company-Id":
            "",


          "Company-Ext":
            "",


          "Platform":
            "ANDROID",


          "Mac-Addr":
            "56cb5d6cc7274364",


          "Host":
            "app.alfastore.co.id",


          "Connection":
            "Keep-Alive",


          "Accept-Encoding":
            "gzip",


          "Content-Type":
            "application/json",

        },


        body:
          JSON.stringify(body),


        cache:
          "no-store",

      }
    );



    const text =
      await response.text();



    const contentType =
      response.headers.get("content-type") || "";



    let result;



    try {

      result =
        JSON.parse(text);

    } catch {

      result =
        text;

    }




    if (!response.ok) {


      return NextResponse.json(

        {

          success:
            false,


          message:
            "AlfaStore API error",


          status:
            response.status,


          response:
            result,

        },

        {

          status:
            response.status,

        }

      );

    }




    return NextResponse.json(

      {

        success:
          true,


        contentType,


        data:
          result,

      }

    );



  } catch (error) {


    console.error(
      "SAVE PER ITEM ERROR:",
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
