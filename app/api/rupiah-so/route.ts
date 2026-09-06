import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";

export async function POST(req: NextRequest) {
  try {

    const body = await req.text();

    const response = await fetch(ALFASTORE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",

        // header penting AlfaStore
        "User-Agent":
          "Dalvik/2.1.0 (Linux; Android 11)",
        "App-Name": "SO-PDA",
        "Version-App": "V.2026.04.13.01-alfa",
        "Version-Code": "28",

        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      body,
    });


    const html = await response.text();


    return new NextResponse(html, {
      status: response.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",

        // supaya tidak kena cache
        "Cache-Control": "no-store",
      },
    });


  } catch (error:any) {

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
