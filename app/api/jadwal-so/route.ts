import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  process.env.ALFASTORE_API_URL ??
  "https://app.alfastore.co.id";


export async function GET(req: NextRequest) {

  const { searchParams } = new URL(req.url);

  const storeId =
    searchParams.get("storeId") ||
    process.env.ALFA_STORE_ID ||
    "M604";


  const url =
    `${ALFASTORE_URL}/prd/api/so/utility/get_jadwal?storeId=${storeId}`;


  try {

    const response = await fetch(url, {

      method: "GET",

      headers: {

        "App-Name":
          process.env.ALFA_APP_NAME ?? "SO-PDA",

        "Version-App":
          process.env.ALFA_VERSION_APP ??
          "V.2026.04.13.01-alfa",

        "Version-Code":
          process.env.ALFA_VERSION_CODE ?? "28",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


        "App-Uid":
          process.env.ALFA_APP_UID ?? "",

        "User-Id":
          process.env.ALFA_USER_ID ?? "",

        "Store-Id":
          storeId,

        "Store-Id-Ext":
          process.env.ALFA_STORE_EXT ?? "",

        "Shard-Id":
          process.env.ALFA_SHARD_ID ?? "",

        "Ip-Addr":
          process.env.ALFA_IP_ADDR ?? "10.1.10.1",

        "Sn":
          process.env.ALFA_SN ?? "",

        "Api-Key":
          process.env.ALFA_API_KEY ?? "",

        "Androidid":
          process.env.ALFA_ANDROID_ID ?? "",

        "Branch-Id":
          process.env.ALFA_BRANCH_ID ?? "",

        "Class-Store":
          process.env.ALFA_CLASS_STORE ?? "",

        "Company-id":
          process.env.ALFA_COMPANY_ID ?? "",

        "Platform":
          "ANDROID",

        "Mac-Addr":
          process.env.ALFA_MAC_ADDR ?? "",

        "Accept-Encoding":
          "gzip",

        "Connection":
          "Keep-Alive",

        "Host":
          "app.alfastore.co.id"

      }

    });


    const contentType =
      response.headers.get("content-type");


    const data =
      contentType?.includes("application/json")
        ? await response.json()
        : await response.text();


    return NextResponse.json(
      data,
      {
        status: response.status
      }
    );


  } catch(error:any){

    return NextResponse.json(
      {
        error:true,
        message:error.message
      },
      {
        status:500
      }
    );

  }

}
