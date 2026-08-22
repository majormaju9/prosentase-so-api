import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get("storeId") || "M604";
    const userId = searchParams.get("userId") || "23067884";
    const periode1 = searchParams.get("periode1");
    const periode2 = searchParams.get("periode2");

    if (!periode1 || !periode2) {
      return NextResponse.json(
        {
          success: false,
          message: "periode1 dan periode2 wajib diisi",
        },
        { status: 400 }
      );
    }

    const targetUrl =
      "https://app.alfastore.co.id/prd/api/jasper-rpt/laporan/daily_performance/download_report";

    const url = new URL(targetUrl);

    url.searchParams.set("storeId", storeId);
    url.searchParams.set("userId", userId);
    url.searchParams.set("periode1", periode1);
    url.searchParams.set("periode2", periode2);

    const response = await fetch(url.toString(), {
      method: "GET",

      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",

        "user-id": userId,

        "User-Agent":
          req.headers.get("user-agent") ||
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.0.0 Mobile Safari/537.36",

        "store-id-ext": "",
        "branch-id": "MZ01",
        "version-app": "",
        platform: "ANDROID",
        "class-store": "A",
        "app-name": "STR-PDA",
        "company-ext": "",

        "sec-ch-ua":
          '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',

        "company-id": "",

        "api-key":
          process.env.ALFA_API_KEY ||
          "iVOZX9MLMKrj1L8R23uFlaryMR1VGMXG",

        "Upgrade-Insecure-Requests": "1",

        "version-code": "",
        "content-type": "application/json",

        "mac-addr": "712f8db18eeb1816",
        Sn: "",
        "store-id": storeId,
        "app-uid": "",

        "Accept-Encoding": "gzip",
      },

      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      const body = await response.text();

      return NextResponse.json(
        {
          success: false,
          status: response.status,
          statusText: response.statusText,
          error: body,
        },
        {
          status: response.status,
        }
      );
    }

    const data = await response.arrayBuffer();

    const contentType =
      response.headers.get("content-type") ||
      "application/octet-stream";

    const contentDisposition =
      response.headers.get("content-disposition") ||
      `attachment; filename="daily_performance_${storeId}_${periode1}_${periode2}.pdf"`;

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
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
