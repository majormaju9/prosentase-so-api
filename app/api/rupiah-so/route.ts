import { NextResponse } from "next/server";

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);

  const storeId = searchParams.get("storeId");
  const dateSo = searchParams.get("dateSo");

  const url =
    `https://app.alfastore.co.id/prd/api/so/entry_kkso/prosentase-so?storeId=${storeId}&dateSo=${dateSo}`;


  const response = await fetch(url, {
    method: "GET",
    headers: {
      "App-Name": "SO-PDA",
      "Version-App": "V.2026.04.13.01-alfa",
      "Version-Code": "28",
      "User-Agent":
        "Dalvik/2.1.0 (Linux; Android 11)",
    },
  });


  const html = await response.text();


  return new NextResponse(html, {
    status: response.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });

}
