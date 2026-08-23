import { NextRequest, NextResponse } from "next/server";

const API_URL =
  "https://hoproin0201.sat.co.id/get/listphoto";


export async function GET(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId") || "M604";


    const response = await fetch(API_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",

        "App-Name": "PROIN-PDA",
        "Version-App": "2025.08.25",

        "User-Id": "23067884",
        "Store-Id": storeId,

        "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "AndroidId": "712f8db18eeb1816",

        "Branch-Id": "MZ01",
        "Platform": "ANDROID",

      },


      body: JSON.stringify({

        method: "photo_layout",

        store_id: storeId,

        branch_id: "MZ01",

        key_kiriman: "SAT"

      }),


      cache: "no-store"

    });


    const text = await response.text();


    if (!response.ok) {

      return NextResponse.json(
        {
          success:false,
          status:response.status,
          data:text
        },
        {
          status:response.status
        }
      );

    }


    return NextResponse.json({

      success:true,

      data: JSON.parse(text)

    });


  } catch(error:any){

    return NextResponse.json(
      {
        success:false,
        message:error.message
      },
      {
        status:500
      }
    );

  }
}
