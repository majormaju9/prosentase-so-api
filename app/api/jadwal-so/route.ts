import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_HOST =
  process.env.ALFASTORE_HOST || "https://app.alfastore.co.id";

const API_KEY =
  process.env.ALFASTORE_API_KEY ||
  "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";


function getHeaders(
  userId: string,
  storeId: string
) {
  return {

    // Header mengikuti SO-PDA APK
    "App-Name": "SO-PDA",

    "Version-App":
      "V.2025.10.03.01",

    "Version-Code":
      "30",

    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15)",

    "App-Uid":
      userId,

    "User-Id":
      userId,

    "Store-Id":
      storeId,

    "Store-Id-Ext":
      "",

    "Shard-Id":
      "",

    "Ip-Addr":
      "",

    "Sn":
      "",

    "Api-Key":
      API_KEY,

    "AndroidId":
      "",

    "Branch-Id":
      "",

    "Content-Type":
      "application/json",

    Accept:
      "application/json"

  };
}


export async function GET(
  req: NextRequest
) {

  try {

    const { searchParams } =
      new URL(req.url);


    const storeId =
      searchParams.get("storeId") || "M604";


    const userId =
      searchParams.get("userId") || "";


    const url =
      `${ALFASTORE_HOST}` +
      `/prd/api/rpt/laporan_so/jadwal_so_vs_sudah_so` +
      `?storeId=${storeId}`;


    const response =
      await fetch(url, {

        method: "GET",

        headers:
          getHeaders(
            userId,
            storeId
          ),

        cache:
          "no-store"

      });


    const text =
      await response.text();


    let data;

    try {

      data =
        JSON.parse(text);

    } catch {

      data =
      {
        html:text
      };

    }


    return NextResponse.json({

      success:
        response.ok,

      status:
        response.status,


      request:{
        app:
          "SO-PDA",

        endpoint:
          "/jadwal_so_vs_sudah_so",

        storeId,

        userId

      },


      data

    });


  } catch(error:any) {


    return NextResponse.json({

      success:false,

      message:
        error.message

    },{
      status:500
    });


  }

}
