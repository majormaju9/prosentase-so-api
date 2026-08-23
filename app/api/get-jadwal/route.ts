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

        "Content-Type": "application/json",

        "Accept": "application/json",

        "Api-Key":
          "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "App-Name":
          "CEXP-CLOUD",

        "App-Uid":
          "10365",

        "Branch-Id":
          "MZ01",

        "Class-Store":
          "A",

        "Company-Id":
          "SAT",

        "Ip-Addr":
          "0.0.0.0",

        "Mac-Addr":
          "712f8db18eeb1816",

        "Platform":
          "ANDROID",

        "Shard-Id":
          "Sn",

        "Sn":
          "712f8db18eeb1816",

        "Store-Id":
          storeId,

        "User-Id":
          "23067884",

        "Version-App":
          "2025.05.20.1",

        "Version-Code":
          "9",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)"

      },

      cache:"no-store"

    });


    const result = await response.text();


    let data;

    try {

      data = JSON.parse(result);

    } catch {

      data = result;

    }


    if(!response.ok){

      return NextResponse.json({

        success:false,

        status:response.status,

        message:"AlfaStore API error",

        data

      },{
        status:response.status
      });

    }


    return NextResponse.json({

      success:true,

      source:"AlfaStore",

      endpoint:"get_jadwal",

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
