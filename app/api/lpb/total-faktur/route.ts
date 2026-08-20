import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/TotalFaktur/";


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
          success: false,
          message:
            "storeId dan faktur wajib diisi"
        },
        {
          status: 400
        }
      );

    }


    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&faktur=${encodeURIComponent(faktur)}`;



    const response =
      await fetch(apiUrl, {

        method: "GET",

        headers: {
          "App-Name": "CEXP-CLOUD",
          "Accept": "application/json"
        },

        cache: "no-store"

      });



    const data =
      await response.text();



    return new NextResponse(
      data,
      {
        status: response.status,

        headers: {
          "Content-Type":
            response.headers.get("content-type")
            ??
            "application/json",

          "Cache-Control":
            "no-store"
        }
      }
    );



  } catch (error) {


    return NextResponse.json(
      {
        success:false,

        message:
          "Server error Total Faktur",

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
