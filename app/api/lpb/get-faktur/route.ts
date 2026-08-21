import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_faktur/";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return NextResponse.json(
        { message: "storeId wajib diisi" },
        { status: 400 }
      );
    }

    const url = new URL(ALFASTORE_URL);
    url.searchParams.set("storeId", storeId);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",

      headers: {
        "App-Name": "LPB-CLOUD",
        "Version-App": "V.2025.11.25.04",
        "Version-Code": "30",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "App-Uid": "",

        "User-Id": "23067884",

        "Store-Id": storeId,

        "Store-Id-Ext": "",

        "Shard-Id": "",

        "Ip-Addr": "10.1.10.1",

        Sn: "",

        "Api-Key": "ivOZX9MLMKrjl8R23uFlaryMRIvGMXG",

        AndroidId: "712f8db18eeb1816",

        "Branch-Id": "MZO1",

        "Class-Store": "",

        "Company-Id": "",

        "Company-Ext": "",

        Platform: "ANDROID",

        "Mac-Addr": "712f8db18eeb1816",

        Connection: "Keep-Alive",

        "Accept-Encoding": "gzip",
      },
    });

    const body = await response.text();

    console.log("URL:", url.toString());
    console.log("STATUS:", response.status);
    console.log("BODY:", body);

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json",
      },
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Proxy error",
      },
      {
        status: 500,
      }
    );
  }
}
