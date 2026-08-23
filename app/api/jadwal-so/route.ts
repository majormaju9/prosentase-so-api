import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  process.env.ALFASTORE_API_URL ??
  "https://app.alfastore.co.id";


export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url);

  const storeId =
    searchParams.get("storeId") ??
    process.env.ALFA_STORE_ID ??
    "M604";


  const url =
    `${ALFASTORE_URL}/prd/api/so/utility/get_jadwal?storeId=${storeId}`;


  try {

    const response = await fetch(url, {

      method: "GET",

      headers: {

        "App-Name":
          process.env.ALFA_APP_NAME ??
          "S0-PDA",

        "Version-App":
          process.env.ALFA_VERSION_APP ??
          "V.2026.04.13.01-alfa",

        "Version-Code":
          process.env.ALFA_VERSION_CODE ??
          "28",


        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


        "Api-Key":
          process.env.ALFA_API_KEY ??
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",


        "Androidid":
          process.env.ALFA_ANDROID_ID ??
          "59b482857ac93239",


        "Platform":
          "ANDROID",


        "Store-Id":
          storeId,


        "App-Uid":
          process.env.ALFA_APP_UID ?? "",


        "User-Id":
          process.env.ALFA_USER_ID ?? "",


        "Store-Id-Ext":
          process.env.ALFA_STORE_EXT ?? "",


        "Shard-Id":
          process.env.ALFA_SHARD_ID ?? "",


        "Branch-Id":
          process.env.ALFA_BRANCH_ID ?? "",


        "Company-id":
          process.env.ALFA_COMPANY_ID ?? "",


        "Class-Store":
          process.env.ALFA_CLASS_STORE ?? "",


        "Sn":
          process.env.ALFA_SN ?? "",


        "Mac-Addr":
          process.env.ALFA_MAC_ADDR ?? "",


        "Ip-Addr":
          "10.1.10.1",


        "Accept-Encoding":
          "gzip",


        "Connection":
          "Keep-Alive",


        "Host":
          "app.alfastore.co.id"

      }

    });


    const text =
      await response.text();


    let data:any;


    try {

      data = JSON.parse(text);

    } catch {

      data = text;

    }


    return NextResponse.json(
      data,
      {
        status: response.status
      }
    );


  } catch (error:any) {

    return NextResponse.json(
      {
        success:false,
        error:error.message
      },
      {
        status:500
      }
    );

  }

}
