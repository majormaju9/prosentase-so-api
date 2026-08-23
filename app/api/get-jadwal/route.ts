import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/utility/so/get_jadwal";


export async function POST(request: NextRequest) {

  try {


    const body = await request.json();


    const storeId =
      body.storeId || "M604";

    const date =
      body.date || "19-08-2026";



    const response = await fetch(ALFASTORE_URL, {

      method: "POST",


      headers: {

        "Content-Type":
          "application/json",

        "Accept":
          "application/json",


        "Api-Key":
          "ivOZX9MLmKrj1L8R23uFlaryMRIvGMXG",


        "App-Name":
          "LPB-CLOUD",


        "Version-App":
          "V.2025.11.25.04",


        "Version-Code":
          "30",


        "App-Uid":
          "10365",


        "User-Id":
          "23067884",


        "Store-Id":
          storeId,


        "Shard-Id":
          "",


        "Ip-Addr":
          "10.1.10.1",


        "Sn":
          "712f8db18eeb1816",


        "Android-Id":
          "712f8db18eeb1816",


        "Branch-Id":
          "MZ01",


        "Class-Store":
          "",


        "Company-Id":
          "SAT",


        "Company-Ext":
          "",


        "Platform":
          "ANDROID",


        "Mac-Addr":
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

    });



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



    if(!response.ok){

      return NextResponse.json({

        success:false,

        message:
          "AlfaStore API error",

        status:
          response.status,

        data

      },{
        status:response.status
      });

    }



    return NextResponse.json({

      success:true,

      source:
        "LPB-CLOUD",

      endpoint:
        "get_jadwal",

      request:{
        storeId,
        date
      },

      data

    });



  } catch(error){


    return NextResponse.json({

      success:false,

      message:
        error instanceof Error
        ? error.message
        : String(error)

    },{
      status:500
    });


  }

}
