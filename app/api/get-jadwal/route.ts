import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


export async function GET(req: NextRequest) {

  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const beginDate =
      searchParams.get("beginDate");

    const endDate =
      searchParams.get("endDate");


    if (!beginDate || !endDate) {
      return NextResponse.json(
        {
          success:false,
          message:"beginDate dan endDate wajib"
        },
        {
          status:400
        }
      );
    }


    const url =
      `${ALFASTORE_URL}` +
      `?storeId=${storeId}` +
      `&beginDate=${beginDate}` +
      `&endDate=${endDate}`;


    const response = await fetch(url, {

      method:"GET",

      headers: {

        "Content-Type":
          "application/json",

        "Accept":
          "application/json",

        "App-Name":
          "PDA",

        "Api-Key":
          "ivOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "Version-App":
          "2024.11.12.09",

        "Store-Id":
          storeId,

        "Mac-Addr":
          "712f8db18eeb1816",

        "AndroidId":
          "712f8db18eeb1816",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)"

      },

      cache:"no-store"

    });


    const text =
      await response.text();


    if(!response.ok){

      return NextResponse.json(
        {
          success:false,
          status:response.status,
          response:text
        },
        {
          status:response.status
        }
      );

    }


    let data;

    try{
      data=JSON.parse(text);
    }
    catch{
      data=text;
    }


    return NextResponse.json({

      success:true,
      data

    });


  }
  catch(error){

    return NextResponse.json(
      {
        success:false,
        error:
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
