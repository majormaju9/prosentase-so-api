import { NextRequest } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/rpt_plu_discontinue";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Bisa custom dari URL, default M604
    const storeId = searchParams.get("storeId") || "M604";

    const apiUrl =
      `${ALFASTORE_URL}?` +
      new URLSearchParams({
        storeId,
        userId: "23067884",
        filter_tag: "DGS",
      }).toString();

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "App-Name": "CEXP-CLOUD",
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    });

    const result = await response.text();

    return new Response(result, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil laporan AlfaStore",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
