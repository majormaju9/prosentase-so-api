import { NextRequest, NextResponse } from "next/server";


const ALFA_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";



/**
 * TEST API
 * buka:
 * /api/save-per-item?storeId=M604&date=23-09-2026
 */
export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url);

  return NextResponse.json({
    success: true,
    message: "API save-per-item aktif",
    storeId: searchParams.get("storeId"),
    date: searchParams.get("date"),
    method: "GET"
  });

}



/**
 * SAVE KKSO ITEM
 */
export async function POST(req: NextRequest) {

  try {


    const body = await req.json();



    const alfaResponse = await fetch(
      ALFA_URL,
      {
        method: "POST",

        headers: {

          "Content-Type":
            "application/json; charset=utf-8",

          "Accept":
            "application/json",

          "Api-Key":
            process.env.ALFA_API_KEY ??
            "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",


          "User-Id":
            "23067884",


          "Store-Id":
            body.kodeToko ?? "M604",


          "Branch-Id":
            "MZ01",


          "Version-App":
            "V.2026.04.13.01-alfa",


          "Platform":
            "ANDROID",


          "Connection":
            "Keep-Alive"

        },


        body:
          JSON.stringify(body)

      }
    );



    const result =
      await alfaResponse.json();



    return NextResponse.json(

      {
        success:
          alfaResponse.ok,

        alfaStatus:
          alfaResponse.status,

        response:
          result
      },


      {
        status:
          alfaResponse.status
      }

    );



  } catch (error:any) {


    console.error(
      "SAVE PER ITEM ERROR:",
      error
    );



    return NextResponse.json(

      {
        success:false,

        error:
          error.message ??
          "Internal Server Error"
      },


      {
        status:500
      }

    );

  }

}
