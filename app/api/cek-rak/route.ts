import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/cetak_kkso/cek_rak";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);


    const storeId =
      searchParams.get("storeId");

    const menuList =
      searchParams.get("menuList");

    const rakSo =
      searchParams.get("rakSo");

    const lang =
      searchParams.get("lang");

    const dateSo =
      searchParams.get("dateSo");

    const remakeSo =
      searchParams.get("remakeSo");

    const typeSo =
      searchParams.get("typeSo");

    const userSo =
      searchParams.get("userSo");



    if (
      !storeId ||
      !menuList ||
      !rakSo ||
      !lang ||
      !dateSo ||
      !remakeSo ||
      !typeSo ||
      !userSo
    ) {

      return NextResponse.json(
        {
          success:false,

          message:
          "storeId, menuList, rakSo, lang, dateSo, remakeSo, typeSo dan userSo wajib diisi"
        },
        {
          status:400
        }
      );

    }



    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&menuList=${encodeURIComponent(menuList)}` +
      `&rakSo=${encodeURIComponent(rakSo)}` +
      `&lang=${encodeURIComponent(lang)}` +
      `&dateSo=${encodeURIComponent(dateSo)}` +
      `&remakeSo=${encodeURIComponent(remakeSo)}` +
      `&typeSo=${encodeURIComponent(typeSo)}` +
      `&userSo=${encodeURIComponent(userSo)}`;



    const response = await fetch(
      apiUrl,
      {

        method:"GET",

        headers:{

          "App-Name":
          "SO-PDA",


          "Version-App":
          "V.2026.04.13.01-alfa",


          "Version-Code":
          "28",


          "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


          "Platform":
          "ANDROID",


          "Api-Key":
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",


          "Accept-Encoding":
          "gzip",


          "Connection":
          "Keep-Alive",


          "Host":
          "app.alfastore.co.id"

        },


        cache:"no-store"

      }
    );



    const contentType =
      response.headers.get(
        "content-type"
      ) || "";



    const data =
      await response.text();




    if(!response.ok){

      return NextResponse.json(

        {
          success:false,

          message:
          "AlfaStore API error",

          status:
          response.status,

          response:data
        },

        {
          status:
          response.status
        }

      );

    }



    let result;


    try{

      result =
      JSON.parse(data);

    }
    catch{

      result=data;

    }




    return NextResponse.json(

      {

        success:true,

        contentType,

        data:result

      }

    );



  }

  catch(error){


    console.error(
      "CEK RAK ERROR:",
      error
    );


    return NextResponse.json(

      {

        success:false,

        message:
        "Internal server error",

        error:
        String(error)

      },

      {
        status:500
      }

    );


  }

}
