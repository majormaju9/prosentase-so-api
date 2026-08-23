import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/sis/utility/so/get_jadwal";


async function requestAlfaStore(storeId: string, date: string) {

  const response = await fetch(ALFASTORE_URL, {

    method: "POST",

    headers: {

      "Content-Type": "application/json",
      "Accept": "application/json",

      "Api-Key":
        "ivOZX9MLmKrj1L8R23uFlaryMRIvGMXG",

      "App-Name":
        "LPB-CLOUD",

      "Version-App":
        "V.2025.11.25.04",

      "Version-Code":
        "30",

      "App-Uid":
        "10365",

      "User-Id":
        "23067884",

      "Store-Id":
        storeId,

      "Ip-Addr":
        "10.1.10.1",

      "Sn":
        "712f8db18eeb1816",

      "Android-Id":
        "712f8db18eeb1816",

      "Branch-Id":
        "MZ01",

      "Platform":
        "ANDROID",

      "Mac-Addr":
        "712f8db18eeb1816",

      "User-Agent":
        "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)"
    },


    body: JSON.stringify({

      storeId,
      date

    }),


    cache:"no-store"

  });


  const text = await response.text();


  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }


  return {

    status: response.status,

    data

  };

}



// TEST VIA BROWSER
export async function GET(request: NextRequest){

  const {searchParams} =
    new URL(request.url);


  const storeId =
    searchParams.get("storeId") || "M604";


  const date =
    searchParams.get("date") || "19-08-2026";


  const result =
    await requestAlfaStore(storeId,date);


  return NextResponse.json({

    success:true,

    method:"GET -> POST AlfaStore",

    result

  });

}



// CLIENT POST
export async function POST(request:NextRequest){

  const body =
    await request.json();


  const storeId =
    body.storeId || "M604";


  const date =
    body.date || "19-08-2026";


  const result =
    await requestAlfaStore(storeId,date);


  return NextResponse.json({

    success:true,

    method:"POST",

    result

  });

}
