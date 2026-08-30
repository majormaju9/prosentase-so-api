import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/mob/tablet/pricetag/delete_plu/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeid = searchParams.get("storeid");
    const plu = searchParams.get("plu");
    const rack = searchParams.get("rack");

    if (!storeid || !plu || !rack) {
      return NextResponse.json(
        {
          error: true,
          message: "storeid, plu, dan rack wajib diisi",
        },
        { status: 400 }
      );
    }

    const targetUrl =
      `${ALFASTORE_URL}` +
      `?storeid=${encodeURIComponent(storeid)}` +
      `&plu=${encodeURIComponent(plu)}` +
      `&rack=${encodeURIComponent(rack)}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",

        "App-Name": "PRTAG-PDA",
        "App-Uid": process.env.ALFA_APP_UID || "",
        "Api-Key": process.env.ALFA_API_KEY || "",

        "Store-Id": storeid,
        "Branch-Id": "MZ01",
        "Class-Store": "V",
        "Company-Id": "SAT",
        Platform: "ANDROID",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Mobile)",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();

      return NextResponse.json(data, {
        status: response.status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": contentType || "text/plain",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: "Gagal menjalankan delete_plu",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
