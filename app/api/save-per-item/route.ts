import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";



export async function GET() {

  return NextResponse.json({
    success:true,
    message:"API save_per_item aktif. Gunakan POST."
  });

}



export async function POST(request: NextRequest) {

  try {


    const body = await request.json();


    if(!body.kodeToko || !body.dateSo || !body.data){

      return NextResponse.json(
        {
          success:false,
          message:
          "kodeToko, dateSo dan data wajib ada"
        },
        {
          status:400
        }
      );

    }



    const response = await fetch(
      ALFASTORE_URL,
      {

        method:"POST",


        headers:{

          "App-Name":
          "SO-PDA",

          "Version-App":
          "V.2026.04.13.01-alfa",

          "Version-Code":
          "28",


          "Platform":
          "ANDROID",


          "Mac-Addr":
          "712f8db18eeb1816",


          "Api-Key":
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",


          "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


          "Accept-Encoding":
          "gzip",


          "Connection":
          "Keep-Alive",


          "Content-Type":
          "application/json; charset=utf-8"

        },


        body:
        JSON.stringify(body),


        cache:
        "no-store"

      }
    );



    const text =
    await response.text();



    let result;


    try{

      result =
      JSON.parse(text);

    }
    catch{

      result=text;

    }



    return NextResponse.json(

      {
        success:
        response.ok,

        status:
        response.status,

        data:
        result

      },

      {
        status:
        response.status
      }

    );



  }
  catch(error){


    return NextResponse.json(

      {
        success:false,
        message:String(error)
      },

      {
        status:500
      }

    );


  }


}
