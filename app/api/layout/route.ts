import { NextRequest, NextResponse } from "next/server";

const API_URL =
  "https://hoproin0201.sat.co.id/get/listphoto";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);

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


    // Request ke HOPROIN
    const response = await fetch(API_URL, {

      method:"POST",

      headers:{
        "Content-Type":"application/json",
        "Accept":"application/json",

        "App-Name":"PROIN-PDA",
        "Version-App":"2025.08.25",

        "User-Id":"23067884",
        "Store-Id":storeId,

        "Api-Key":"iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "AndroidId":"712f8db18eeb1816",

        "Branch-Id":"MZ01",
        "Platform":"ANDROID"
      },


      body:JSON.stringify({

        method:"photo_layout",

        store_id:storeId,

        branch_id:"MZ01",

        key_kiriman:"SAT"

      }),

      cache:"no-store"

    });


    const json = await response.json();


    if(
      !response.ok ||
      json.Err_No !== "0"
    ){

      return NextResponse.json(
        {
          success:false,
          data:json
        },
        {
          status:500
        }
      );

    }


    const imageUrl = json.url;


    // Ambil gambar dari intranet SAT
    const imageResponse =
      await fetch(imageUrl);


    if(!imageResponse.ok){

      return NextResponse.json(
        {
          success:false,
          message:"Gagal mengambil gambar"
        },
        {
          status:500
        }
      );

    }


    const imageBuffer =
      await imageResponse.arrayBuffer();


    // langsung tampil gambar di browser
    return new NextResponse(
      imageBuffer,
      {
        headers:{
          "Content-Type":
            "image/jpeg",

          "Cache-Control":
            "public, max-age=86400"
        }
      }
    );


  } catch(error:any){

    return NextResponse.json(
      {
        success:false,
        message:error.message
      },
      {
        status:500
      }
    );

  }

}
