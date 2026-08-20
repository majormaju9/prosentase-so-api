import { NextRequest } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_det_faktur";


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

      return Response.json(
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


    const response =
      await fetch(
        ALFASTORE_URL,
        {

          method:"POST",

          headers:{

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


            "Store-Id":
            storeId,


            "Api-Key":
            "ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",


            "AndroidId":
            "712f8db18eeb1816",


            "Platform":
            "ANDROID",


            "Accept":
            "application/json",


            "Content-Type":
            "application/json",


            "Accept-Encoding":
            "gzip"

          },


          body:
          JSON.stringify({

            storeId:
            storeId,

            faktur:
            faktur

          }),


          cache:
          "no-store"

        }
      );



    const result =
      await response.text();



    return new Response(
      result,
      {

        status:
        response.status,


        headers:{

          "Content-Type":
          response.headers.get(
            "content-type"
          )
          ||
          "application/json; charset=utf-8",


          "Cache-Control":
          "no-store"

        }

      }
    );



  } catch(error) {


    return Response.json(
      {

        success:false,

        message:
        "Gagal mengambil detail faktur LPB",


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
