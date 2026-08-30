import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/mob/tablet/pricetag/check_scan/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeid = searchParams.get("storeid");
    const barcode = searchParams.get("barcode");
    const region = searchParams.get("region");

    if (!storeid || !barcode || !region) {
      return NextResponse.json(
        {
          error: true,
          message: "storeid, barcode, dan region wajib diisi",
        },
        { status: 400 }
      );
    }

    const targetUrl =
      `${ALFASTORE_URL}` +
      `?storeid=${encodeURIComponent(storeid)}` +
      `&barcode=${encodeURIComponent(barcode)}` +
      `&region=${encodeURIComponent(region)}`;

    // Ambil body jika request POST mengirim body
    let body: string | undefined;

    try {
      const rawBody = await request.text();

      if (rawBody && rawBody.trim() !== "") {
        body = rawBody;
      }
    } catch {
      body = undefined;
    }

    const response = await fetch(targetUrl, {
      method: "POST",

      headers: {
        "Content-Type":
          request.headers.get("content-type") || "application/json",

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

      ...(body ? { body } : {}),

      cache: "no-store",
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();

      return NextResponse.json(data, {
        status: response.status,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      });
    }

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type":
          contentType || "text/plain; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: true,
        message: "Gagal menjalankan check_scan",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
