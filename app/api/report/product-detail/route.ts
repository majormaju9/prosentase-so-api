import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/to/api/cex/get_product_detail/";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const plu = searchParams.get("plu");

    if (!storeId || !plu) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId dan plu wajib diisi",
        },
        { status: 400 }
      );
    }

    const upstream = new URL(ALFASTORE_URL);

    upstream.searchParams.set("storeId", storeId);
    upstream.searchParams.set("plu", plu);

    const response = await fetch(upstream.toString(), {
      method: "GET",

      headers: {
        Accept: "application/json, text/plain, */*",

        "store-id": storeId,

        "branch-id":
          request.headers.get("branch-id") || "MZ01",

        "class-store":
          request.headers.get("class-store") || "A",

        "app-name":
          request.headers.get("app-name") || "STR-PDA",

        platform:
          request.headers.get("platform") || "ANDROID",

        "api-key":
          request.headers.get("api-key") ||
          "iVOZX9MLMKrj1L8R23uFlaryMR1VGMXG",

        "mac-addr":
          request.headers.get("mac-addr") ||
          "712f8db18eeb1816",
      },

      cache: "no-store",
      redirect: "follow",
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/json";

    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Product Detail",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
