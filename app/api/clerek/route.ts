
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_URL =
  "https://app.alfastore.co.id/prd/api/pos/transaksi/clerek/backup_data_transaksi";

/**
 * GET /api/clerek?filename=M604_2026-11-08_25024591_android.zip
 *
 * Unduh file ZIP Clerek dari server ALFASTORE melalui Next.js di Vercel.
 * PENTING: sebelum dipakai publik, tambahkan verifikasi session/login DAN
 * otorisasi kode toko sesuai sistem autentikasi Anda. Route ini tidak
 * memiliki informasi tentang login aplikasi Anda.
 */
export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("filename")?.trim() ?? "";

  // Boleh: M604_2026-11-08_25024591_android.zip
  // Tolak slash, backslash, query/path traversal, dan ekstensi selain .zip.
  if (!/^[A-Za-z0-9_-]{1,150}\.zip$/i.test(filename)) {
    return NextResponse.json(
      {
        success: false,
        error: "Parameter filename harus berupa nama file .zip yang valid.",
        example: "M604_2026-11-08_25024591_android.zip",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // TODO: Wajib integrasikan autentikasi login dan cek hak akses store ID
  // (contohnya: M604) sebelum mengizinkan unduhan file transaksi.

  const upstreamUrl = new URL(SOURCE_URL);
  upstreamUrl.searchParams.set("filename", filename);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/zip, application/octet-stream, application/json",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const timeout = error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json(
      {
        success: false,
        error: timeout
          ? "Timeout ketika mengunduh ZIP dari API asal."
          : "Tidak dapat menghubungi server API asal.",
      },
      { status: timeout ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return NextResponse.json(
      {
        success: false,
        error: "API asal mengalihkan permintaan; periksa autentikasi sumber.",
        upstreamStatus: upstream.status,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        success: false,
        error: upstream.status === 404
          ? "File ZIP tidak ditemukan di API asal."
          : "API asal tidak berhasil mengirim file ZIP.",
        upstreamStatus: upstream.status,
      },
      {
        status: upstream.status >= 400 && upstream.status <= 599
          ? upstream.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    return NextResponse.json(
      {
        success: false,
        error: "API asal mengembalikan HTML, bukan ZIP. Cek login/izin akses API.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Jika API sumber mengembalikan JSON, jangan menyamarkannya sebagai ZIP.
  if (contentType.includes("application/json")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (!upstream.body) {
    return NextResponse.json(
      { success: false, error: "API asal tidak mengirim isi file." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const headers = new Headers({
    "Content-Type": contentType || "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  const length = upstream.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);

  // Streaming agar file ZIP tidak perlu ditampung penuh di memori Vercel.
  return new Response(upstream.body, { status: 200, headers });
}
