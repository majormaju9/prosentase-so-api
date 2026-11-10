import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL =
  "https://app.alfastore.co.id/prd/api/sis/master/inventory/ringkasan";

export async function GET(request: NextRequest) {
  const plu = request.nextUrl.searchParams.get("plu")?.trim();

  if (!plu) {
    return NextResponse.json(
      { ok: false, error: "Parameter plu wajib diisi" },
      { status: 400 }
    );
  }

  if (!/^\d+$/.test(plu)) {
    return NextResponse.json(
      { ok: false, error: "Parameter plu harus berupa angka" },
      { status: 400 }
    );
  }

  const url = new URL(API_URL);
  url.searchParams.set("plu", plu);

  try {
    const headers: HeadersInit = { Accept: "application/json" };

    // Jika API sumber memerlukan autentikasi, set kredensial resmi
    // di Environment Variables Vercel (jangan hardcode ke source).
    if (process.env.ALFASTORE_BEARER_TOKEN) {
      headers.Authorization = `Bearer ${process.env.ALFASTORE_BEARER_TOKEN}`;
    }
    if (process.env.ALFASTORE_COOKIE) {
      headers.Cookie = process.env.ALFASTORE_COOKIE;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    // Pertahankan format dan HTTP status dari server sumber.
    const contentType =
      response.headers.get("content-type") ?? "application/json; charset=utf-8";

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        ok: false,
        error: timeout ? "API sumber timeout" : "Gagal menghubungi API sumber",
      },
      { status: timeout ? 504 : 502 }
    );
  }
}
