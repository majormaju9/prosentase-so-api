import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/TotalFaktur/";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId") || "M604";
    const faktur = searchParams.get("faktur") || "TH26036888";

    const upstreamUrl = new URL(ALFASTORE_URL);

    upstreamUrl.searchParams.set("storeId", storeId);
    upstreamUrl.searchParams.set("faktur", faktur);

    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",

      headers: {
        Accept: "application/json, text/plain, */*",

        "User-Agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",

        Referer: "https://app.alfastore.co.id/",
      },
    });

    /*
     * Jangan parse JSON.
     * Teruskan RAW response AlfaStore agar format output
     * semirip mungkin dengan endpoint aslinya.
     */
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",

        "Cache-Control":
          response.headers.get("cache-control") ||
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("TOTAL FAKTUR ERROR:", error);

    return NextResponse.json(
      {
        error: true,
        message: "Gagal mengambil TotalFaktur dari AlfaStore",
      },
      {
        status: 500,
      }
    );
  }
}
