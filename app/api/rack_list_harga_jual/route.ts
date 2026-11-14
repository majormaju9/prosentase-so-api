import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_URL =
  "https://app.alfastore.co.id/prd/api/laporan/filter_report/rack_list_harga_jual";

// Header dari tangkapan layar. Simpan file ini hanya di sisi server.
const API_KEY = "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";
const USER_ID = "20020884";
const BRANCH_ID = "MZ01";

export async function GET(request: NextRequest) {
  const storeId = (
    request.nextUrl.searchParams.get("storeId") || "M865"
  ).trim().toUpperCase();

  if (!/^[A-Z0-9]{2,12}$/.test(storeId)) {
    return NextResponse.json(
      { success: false, message: "Parameter storeId tidak valid." },
      { status: 400 }
    );
  }

  const upstreamUrl = new URL(UPSTREAM_URL);
  upstreamUrl.searchParams.set("storeId", storeId);

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "python-requests/2.28.2",
        "Api-Key": API_KEY,
        "App-Name": "InventoryIntelligence",
        Platform: "ANDROID",
        "Store-Id": storeId,
        "User-Id": USER_ID,
        "Branch-Id": BRANCH_ID,
        "Accept-Encoding": "gzip",
        // Host dan Connection diatur otomatis oleh HTTP client Node.js.
      },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json(
        {
          success: false,
          message: "Server Alfastore mengembalikan pengalihan (redirect).",
          upstreamStatus: upstream.status,
        },
        { status: 502 }
      );
    }

    const raw = await upstream.text();
    if (!raw.trim()) {
      return NextResponse.json(
        {
          success: upstream.ok,
          message: upstream.ok
            ? "Server Alfastore mengembalikan respons kosong."
            : "Server Alfastore mengembalikan error tanpa isi.",
          upstreamStatus: upstream.status,
        },
        { status: upstream.ok ? 200 : upstream.status }
      );
    }

    try {
      const data = JSON.parse(raw);
      return NextResponse.json(data, {
        status: upstream.status,
        headers: { "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Respons Alfastore bukan JSON yang valid.",
          upstreamStatus: upstream.status,
          contentType: upstream.headers.get("content-type"),
          preview: raw.slice(0, 500),
        },
        { status: upstream.ok ? 502 : upstream.status }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "Koneksi Alfastore melebihi 20 detik."
        : "Gagal menghubungi server Alfastore.";

    return NextResponse.json(
      { success: false, message },
      { status: 502 }
    );
  }
}
