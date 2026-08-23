import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);


    const storeId =
      searchParams.get("storeId") || "M604";

    const date =
      searchParams.get("date") || "19-08-2026";



    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&date=${encodeURIComponent(date)}`;



    const response = await fetch(apiUrl, {

      method: "GET",


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
          "",


        "User-Id":
          "23067884",


        "Store-Id":
          storeId,


        "Store-Id-Ext":
          "",


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
          "",


        "Company-Ext":
          "",


        "Platform":
          "ANDROID",


        "Mac-Addr":
          "712f8db18eeb1816",


        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)"

      },


      cache:
        "no-store"

    });



    const raw = await response.text();


    let data:any;


    try {

      data = JSON.parse(raw);

    } catch {

      data = {
        html: raw
      };

    }



    if(!response.ok){

      return NextResponse.json({

        success:false,

        message:
          "AlfaStore API error",

        status:
          response.status,

        request:{
          storeId,
          date
        },

        data

      },{
        status:response.status
      });

    }



    return NextResponse.json({

      success:true,

      source:
        "AlfaStore LPB-CLOUD",


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
