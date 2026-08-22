import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/jasper-rpt/laporan/daily_performance/download_report";

export const dynamic = "force-dynamic";

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
        { status: 400 }
      );
    }

    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&userId=${encodeURIComponent(userId)}` +
      `&periode1=${encodeURIComponent(periode1)}` +
      `&periode2=${encodeURIComponent(periode2)}` +
      `&%23toolbar=0`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/pdf,*/*",

        "user-id": userId,
        "store-id": storeId,
        "branch-id": "MZ01",
        "class-store": "A",
        "app-name": "STR-PDA",
        platform: "ANDROID",

        "api-key":
          "iVOZX9MLMKrj1L8R23uFlaryMR1VGMXG",

        "mac-addr":
          "712f8db18eeb1816",
      },

      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          success: false,
          status: response.status,
          message: "AlfaStore gagal mengirim laporan",
          response: errorText,
        },
        {
          status: response.status,
        }
      );
    }

    const pdf = await response.arrayBuffer();

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",

        // INI YANG MEMBUAT PDF TAMPIL,
        // BUKAN LANGSUNG DOWNLOAD
        "Content-Disposition":
          'inline; filename="daily-performance.pdf"',

        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil Daily Performance",
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
