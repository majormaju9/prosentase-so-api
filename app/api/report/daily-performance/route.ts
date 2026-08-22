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

    // Karena link asli memakai %23toolbar=0
    // %23 = karakter #
    const toolbar =
      searchParams.get("#toolbar") ??
      searchParams.get("toolbar") ??
      "0";

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
      `&periode2=${encodeURIComponent(periode2)}` +
      `&%23toolbar=${encodeURIComponent(toolbar)}`;

    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

        "User-Agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36",

        "user-id": userId,

        "store-id": storeId,

        "store-id-ext":
          request.headers.get("store-id-ext") || "",

        "branch-id":
          request.headers.get("branch-id") || "MZ01",

        "class-store":
          request.headers.get("class-store") || "A",

        "app-name":
          request.headers.get("app-name") || "STR-PDA",

        "platform":
          request.headers.get("platform") || "ANDROID",

        "api-key":
          request.headers.get("api-key") ||
          "iVOZX9MLMKrj1L8R23uFlaryMR1VGMXG",

        "mac-addr":
          request.headers.get("mac-addr") ||
          "712f8db18eeb1816",

        "Content-Type": "application/json",

        "Upgrade-Insecure-Requests": "1",
      },

      cache: "no-store",
      redirect: "follow",
    });

    const data = await response.arrayBuffer();

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    const contentDisposition =
      response.headers.get("content-disposition");

    const headers = new Headers();

    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "no-store");

    if (contentDisposition) {
      headers.set(
        "Content-Disposition",
        contentDisposition
      );
    }

    return new NextResponse(data, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal mengambil Daily Performance AlfaStore",
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
