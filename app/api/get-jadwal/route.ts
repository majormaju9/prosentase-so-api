import { NextRequest } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const apiUrl =
      `${ALFASTORE_URL}?` +
      Array.from(searchParams.entries())
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join("&");

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
          "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil jadwal AlfaStore",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
