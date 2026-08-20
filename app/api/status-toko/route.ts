import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/master/status_toko/";


export async function GET(
  request: NextRequest
) {

  try {


    const {
      searchParams
    } = new URL(request.url);



    const storeId =
      searchParams.get("storeId");



    if (!storeId) {

      return NextResponse.json(
        {
          success:false,
          message:"storeId wajib diisi"
        },
        {
          status:400
        }
      );

    }



    const apiUrl =
      `${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}`;



    const response =
      await fetch(
        apiUrl,
        {

          method:"GET",

          headers:{

            "App-Name":
            "CEXP-CLOUD",

          },

          cache:"no-store"

        }
      );



    const data =
      await response.text();



    return new NextResponse(
      data,
      {

        status:response.status,

        headers:{

          "Content-Type":
          response.headers.get(
            "content-type"
          )
          ||
          "application/json",

          "Cache-Control":
          "no-store"

        }

      }
    );



  }
  catch(error){


    return NextResponse.json(
      {

        success:false,

        message:
        "Gagal mengambil status toko AlfaStore",

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
