import { NextRequest, NextResponse } from "next/server";

const HOPROIN_URL =
  "https://hoproin0201.sat.co.id/get/listphoto";


export async function GET(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId") || "M604";
    const userId = searchParams.get("userId") || "23067884";
    const branchId = searchParams.get("branchId") || "MZ01";


    const response = await fetch(HOPROIN_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "App-Name": "PROIN-PDA",
        "Version-App": "2025.08.25",
        "User-Id": userId,
        "Store-Id": storeId,
        "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
        "AndroidId": "712f8db18eeb1816",
        "Branch-Id": branchId,
        "Platform": "ANDROID",
      },

      body: JSON.stringify({
        storeId,
        userId,
        branchId
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


    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }


    return NextResponse.json({
      success:true,
      data
    });


  } catch(error:any){

    return NextResponse.json({
      success:false,
      message:error.message
    },{
      status:500
    });

  }
}
