import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";



export async function POST(request: NextRequest) {

  try {


    const body = await request.json();



    if (!body || Object.keys(body).length === 0) {

      return NextResponse.json(
        {
          success:false,
          message:"Request body kosong"
        },
        {
          status:400
        }
      );

    }



    const response = await fetch(ALFASTORE_URL, {


      method:"POST",



      headers:{


        "App-Name":
          "SO-PDA",


        "Version-App":
          "V.2026.04.13.01-alfa",


        "Version-Code":
          "28",


        "Platform":
          "ANDROID",


        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",



        "Api-Key":
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",



        "User-Id":
          "23067884",



        "Store-Id":
          "M604",



        "Branch-Id":
          "MZ01",



        "AndroidId":
          "56cb5d6cc7274364",



        "Mac-Addr":
          "56cb5d6cc7274364",



        "Content-Type":
          "application/json",


        "Accept":
          "application/json",


      },



      body:
        JSON.stringify(body),



      cache:
        "no-store"

    });




    const text =
      await response.text();




    let result;



    try {

      result =
        JSON.parse(text);

    }

    catch {

      result =
        text;

    }




    return NextResponse.json(

      {

        success:
          response.ok,


        status:
          response.status,


        data:
          result

      },


      {

        status:
          response.status

      }

    );




  }

  catch(error){


    console.error(
      "SAVE PER ITEM ERROR",
      error
    );



    return NextResponse.json(

      {

        success:false,


        message:
          "Internal server error",


        error:
          String(error)

      },


      {

        status:500

      }

    );

  }

}
