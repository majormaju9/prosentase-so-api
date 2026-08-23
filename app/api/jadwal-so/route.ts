import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_HOST =
  process.env.ALFASTORE_HOST || "https://app.alfastore.co.id";

const API_KEY =
  process.env.ALFASTORE_API_KEY ||
  "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";


function getHeaders(params: {
  userId?: string;
  storeId?: string;
}) {
  return {
    "App-Name": "SO-PDA",
    "Version-App": "V.2025.10.03.01",
    "Version-Code": "30",

    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15)",

    "App-Uid": params.userId || "",
    "User-Id": params.userId || "",

    "Store-Id": params.storeId || "",
    "Store-Id-Ext": "",

    "Shard-Id": "",

    "Ip-Addr": "",

    "Sn": "",

    "Api-Key": API_KEY,

    "AndroidId": "",

    "Branch-Id": "",

    "Content-Type": "application/json",
    Accept: "application/json",
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


    const periode1 =
      searchParams.get("periode1") || "";

    const periode2 =
      searchParams.get("periode2") || "";


    /*
      Endpoint SO-PDA
      sesuaikan dengan endpoint asli
      dari hasil capture APK
    */

    const url =
      `${ALFASTORE_HOST}/prd/api/so/laporan/stock_opname` +
      `?storeId=${storeId}` +
      `&periode1=${periode1}` +
      `&periode2=${periode2}`;


    const response =
      await fetch(url, {

        method:"GET",

        headers:
          getHeaders({
            userId,
            storeId
          }),

        cache:"no-store"

      });


    const text =
      await response.text();


    let data:any;

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
        app:"SO-PDA",
        storeId,
        userId,
        periode1,
        periode2
      },

      data

    });


  } catch(error:any){


    return NextResponse.json({

      success:false,

      message:
        error.message

    },{
      status:500
    });


  }

}
