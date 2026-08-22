import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/jasper-rpt/laporan/daily_performance/download_report";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const userId = searchParams.get("userId");
    const periode1 = searchParams.get("periode1");
    const periode2 = searchParams.get("periode2");

    if (!storeId || !userId || !periode1 || !periode2) {
      return NextResponse.json(
        {
          success: false,
          message:
            "storeId, userId, periode1, dan periode2 wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&userId=${encodeURIComponent(userId)}` +
      `&periode1=${encodeURIComponent(periode1)}` +
      `&periode2=${encodeURIComponent(periode2)}`;

    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        "App-Name": "CEXP-CLOUD",
      },

      cache: "no-store",
      redirect: "follow",
    });

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: response.status,

      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",

        ...(response.headers.get("content-disposition")
          ? {
              "Content-Disposition":
                response.headers.get("content-disposition")!,
            }
          : {}),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil daily performance AlfaStore",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
