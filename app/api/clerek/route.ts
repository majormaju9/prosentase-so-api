import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_URL =
  "https://app.alfastore.co.id/prd/api/pos/transaksi/clerek/backup_data_transaksi";

/**
 * GET /api/pos/transaksi/clerek/backup_data_transaksi?filename=M604_2026-11-08_25024591_android.zip
 *
 * Proxy download ZIP Clerek dari API ALFASTORE. Nama file dibatasi agar
 * parameter filename tidak bisa dipakai untuk path traversal.
 *
 * PENTING: Tambahkan pemeriksaan session/login yang sesuai dengan aplikasi
 * Anda sebelum mengaktifkan route ini di website publik.
 */
export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename")?.trim();

  if (!filename || !/^[A-Za-z0-9_-]+\.zip$/i.test(filename)) {
    return NextResponse.json(
      {
        success: false,
        error: "Parameter filename harus berupa nama file ZIP yang valid.",
        example: "M604_2026-11-08_25024591_android.zip",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(UPSTREAM_URL);
  url.searchParams.set("filename", filename);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/zip, application/octet-stream, application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        error: timedOut
          ? "Waktu mengambil file ZIP dari server ALFASTORE habis."
          : "Tidak dapat terhubung ke server ALFASTORE.",
      },
      { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!upstream.ok) {
    const details = (await upstream.text().catch(() => "")).slice(0, 500);
    return NextResponse.json(
      {
        success: false,
        error: "Server ALFASTORE gagal menyediakan file ZIP.",
        upstreamStatus: upstream.status,
        ...(details ? { details } : {}),
      },
      {
        status: upstream.status >= 400 && upstream.status <= 599 ? upstream.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  // Jika API asal mengembalikan JSON (bukan ZIP), teruskan responsnya
  // tanpa mengubahnya menjadi unduhan ZIP yang tidak valid.
  if (contentType.includes("application/json")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (contentType.includes("text/html")) {
    return NextResponse.json(
      {
        success: false,
        error: "Server mengembalikan HTML, bukan ZIP. Periksa akses/login API asal.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = new Headers({
    "Content-Type": contentType || "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  const contentLength = upstream.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    headers.set("Content-Length", contentLength);
  }

  // Streaming: file ZIP tidak perlu dimuat penuh ke memori Vercel.
  return new Response(upstream.body, { status: 200, headers });
}
