import { NextRequest } from "next/server";

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


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&faktur=${encodeURIComponent(faktur)}`;



    const response =
      await fetch(
        apiUrl,
        {

          method:"GET",

          headers:{

            "App-Name":
            "CEXP-CLOUD",

            "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

            "Accept":
            "application/json, text/plain, */*",

            "Referer":
            "https://app.alfastore.co.id/"

          },

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
        "Gagal mengambil detail faktur LPB AlfaStore",

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
