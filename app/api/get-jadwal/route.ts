import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const date = searchParams.get("date");


    if (!storeId || !date) {

      return NextResponse.json(
        {
          success:false,
          message:"storeId dan date wajib diisi"
        },
        {
          status:400
        }
      );

    }


    const url =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&date=${encodeURIComponent(date)}`;


    const res = await fetch(url,{
      method:"GET",

      headers:{
        "App-Name":"CEXP-CLOUD",
        "User-Agent":"Mozilla/5.0",
        "Accept":"application/json"
      },

      cache:"no-store"
    });



    const text = await res.text();


    let data:any;


    try {

      data = JSON.parse(text);

    } catch {

      data = {
        html:text
      };

    }



    if(!res.ok){

      return NextResponse.json(
        {
          success:false,
          status:res.status,
          message:"AlfaStore API error",
          data
        },
        {
          status:res.status
        }
      );

    }



    return NextResponse.json({

      success:true,

      endpoint:"get_jadwal",

      parameter:{
        storeId,
        date
      },

      data

    });



  } catch(error){


    return NextResponse.json({

      success:false,

      message:"Router error",

      error:
        error instanceof Error
        ? error.message
        : String(error)

    },
    {
      status:500
    });


  }

}
