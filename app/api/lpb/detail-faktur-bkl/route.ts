import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_BASE = "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/";
const ENDPOINTS = {
  list: "get_faktur/",
  detail: "get_det_faktur_bkl/",
} as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("health") === "1") {
      return NextResponse.json({ ok: true, source: "vercel-route", version: "lpb-404-v2" });
    }

    const storeId = "M604";
    const requestedStoreId = searchParams.get("storeId");

    if (requestedStoreId && requestedStoreId.toUpperCase() !== storeId) {
      return NextResponse.json(
        { error: true, message: "Kode toko harus M604" },
        { status: 400 }
      );
    }
    const faktur = searchParams.get("faktur")?.trim();
    const mode = searchParams.get("mode") || (faktur ? "detail" : "list");
    if (mode !== "list" && mode !== "detail") {
      return NextResponse.json({ error: true, message: "mode harus list atau detail" }, { status: 400 });
    }
    if (mode === "detail" && !faktur) {
      return NextResponse.json({ error: true, message: "faktur wajib diisi untuk mode detail" }, { status: 400 });
    }

    const upstreamUrl = new URL(ENDPOINTS[mode], ALFASTORE_BASE);
    upstreamUrl.searchParams.set("storeId", storeId);
    if (faktur) upstreamUrl.searchParams.set("faktur", faktur);

    // Header dari konfigurasi yang diberikan. Simpan file ini di server privat.
    const apiKey = "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";
    const androidId = "712f8db18eeb1816";
    const userId = "23067884";
    const branchId = "MZ01";

    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",

      redirect: "error",
      headers: {
        "Host": "app.alfastore.co.id",
        "app-name": "LPB-CLOUD",
        "version-app": "V.2025.11.25.04",
        "version-code": "30",
        "user-agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
        "app-uid": "",
        "user-id": userId,
        "store-id": storeId,
        "store-id-ext": "",
        "shard-id": "",
        "ip-addr": "10.1.10.1",
        "sn": "",
        "api-key": apiKey,
        "androidid": androidId,
        "branch-id": branchId,
        "class-store": "",
        "company-id": "",
        "company-ext": "",
        "platform": "ANDROID",
        "mac-addr": androidId,
        "accept-encoding": "gzip",
        "accept": "*/*",
      },
    });

    const body = await response.text();
    if (response.status === 404) {
      return NextResponse.json({
        error: true,
        source: "upstream",
        upstreamStatus: 404,
        endpoint: ENDPOINTS[mode],
        message: "Route Vercel aktif, tetapi endpoint AlfaStore mengembalikan HTTP 404. Periksa path, metode HTTP, parameter dan hak akses resmi API.",
      }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    return new NextResponse(body, {
      status: response.status,

      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json; charset=utf-8",

        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });

  } catch {
    console.error("LPB upstream request failed");

    return NextResponse.json(
      {
        error: true,
        source: "vercel-route",
        message: "Gagal terhubung ke AlfaStore atau terjadi redirect upstream",
      },
      { status: 500 }
    );
  }
}
