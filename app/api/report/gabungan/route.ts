import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/rep_gabungan_23_24";


export async function GET(
  request: NextRequest
) {

  try {


    const {
      searchParams
    } = new URL(request.url);



    const storeId =
      searchParams.get("storeId");


    const periode1 =
      searchParams.get("periode1");



    if (!storeId || !periode1) {

      return NextResponse.json(
        {
          success:false,
          message:
          "storeId dan periode1 wajib diisi"
        },
        {
          status:400
        }
      );

    }



    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&periode1=${encodeURIComponent(periode1)}`;



    const response =
      await fetch(
        apiUrl,
        {

          method:"GET",

          headers:{

            "App-Name":
            "CEXP-CLOUD"

          },

          cache:"no-store"

        }
      );



    const html =
      await response.text();



    return new NextResponse(
      html,
      {

        status:response.status,

        headers:{

          "Content-Type":
          response.headers.get(
            "content-type"
          )
          ||
          "text/html; charset=utf-8",


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
        "Gagal mengambil laporan gabungan AlfaStore",

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
