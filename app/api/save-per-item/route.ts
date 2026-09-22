import { NextRequest, NextResponse } from "next/server";

const ALFA_API =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(ALFA_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",

        // header dari aplikasi Alfa
        "Api-Key": process.env.ALFA_API_KEY ?? 
          "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "User-Id": "23067884",
        "Store-Id": "M604",
        "Branch-Id": "MZ01",
        "Version-App": "V.2026.04.13.01-alfa",
        "Platform": "ANDROID",

        "Accept-Encoding": "gzip",
      },
      body: JSON.stringify(body),
    });


    const result = await response.json();


    return NextResponse.json(
      {
        status: response.status,
        success: response.ok,
        data: result,
      },
      {
        status: response.status,
      }
    );


  } catch (error: any) {

    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: 500,
      }
    );

  }
}
