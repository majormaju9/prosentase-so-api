import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_det_faktur/";


export async function GET(
  request: NextRequest
) {

  try {

    const { searchParams } =
      new URL(request.url);


    const storeId =
      searchParams.get("storeId");

    const faktur =
      searchParams.get("faktur");


    if (!storeId || !faktur) {

      return NextResponse.json(
        {
          success:false,
          message:
          "storeId dan faktur wajib diisi"
        },
        {
          status:400
        }
      );

    }


    const apiUrl =
      `${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}&faktur=${encodeURIComponent(faktur)}`;



    const response =
      await fetch(apiUrl, {

        method:"GET",


        headers: {

          "App-Name":
          "LPB-CLOUD",

          "Version-App":
          "V.2025.11.25.04",

          "Version-Code":
          "30",


          "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",


          "App-Uid":
          "23067884",


          "User-Id":
          "23067884",


          "Store-Id":
          storeId,


          "Api-Key":
          "ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",


          "AndroidId":
          "712f8db18eeb1816",


          "Platform":
          "ANDROID",


          "Host":
          "app.alfastore.co.id",


          "Connection":
          "Keep-Alive",


          "Accept-Encoding":
          "gzip"

        },


        cache:"no-store"

      });



    const result =
      await response.text();



    if (!response.ok) {

      return NextResponse.json(
        {
          success:false,

          status:
          response.status,

          response:
          result
        },
        {
          status:
          response.status
        }
      );

    }



    return NextResponse.json({

      success:true,

      data:
      result

    });



  }
  catch(error){


    return NextResponse.json(
      {
        success:false,

        message:
        "Gagal mengambil detail faktur",

        error:
        error instanceof Error
        ?
        error.message
        :
        String(error)
      },
      {
        status:500
      }
    );


  }

}
