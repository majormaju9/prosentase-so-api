/**
 * Next.js / Vercel App Router
 * Letakkan di: app/api/jadwal-so/route.ts
 * Akses: GET https://DOMAIN-VERCEL-ANDA/api/jadwal-so
 *
 * Sumber: URL endpoint dan header yang dikirim pengguna.
 * URL produksi belum dikonfirmasi berhasil; endpoint mungkin memerlukan sesi resmi.
 *
 * PENTING: Api-Key tertanam secara langsung sesuai permintaan. Simpan file ini
 * HANYA di server. Jangan import ke komponen client atau unggah ke repositori publik.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kode toko & identitas sesuai screenshot; ubah di sini bila berwenang.
const STORE_ID = "M865";
const USER_ID = "20020884";
const BRANCH_ID = "MZ01";

const ALFASTORE_ENDPOINT =
  "https://app.alfastore.co.id/prd/api/sis/utility/jadwal_so_partial/";

// Semua request header disatukan di file route.ts (tidak memerlukan .env).
const REQUEST_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "python-requests/2.28.2",
  "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
  "App-Name": "InventoryIntelligence",
  Platform: "ANDROID",
  "Store-Id": STORE_ID,
  "User-Id": USER_ID,
  "Branch-Id": BRANCH_ID,
  Host: "app.alfastore.co.id",
  Connection: "keep-alive",
  "Accept-Encoding": "gzip",
};

export async function GET() {
  const url = new URL(ALFASTORE_ENDPOINT);
  url.searchParams.set("storeId", STORE_ID);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: REQUEST_HEADERS,
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    const body = await upstream.text();

    // Selalu kembalikan status asli dan respons upstream; tidak mengarang data SO.
    // Jangan meneruskan Content-Encoding atau Content-Length: fetch sudah
    // menangani dekompresi gzip, sehingga header lama dapat merusak respons.
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType.includes("json")
          ? "application/json; charset=utf-8"
          : "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const timeoutOrAbort =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");

    return NextResponse.json(
      {
        success: false,
        message: timeoutOrAbort
          ? "Permintaan Jadwal SO ke ALFASTORE melewati batas waktu."
          : "Tidak dapat menghubungi endpoint Jadwal SO ALFASTORE.",
      },
      { status: timeoutOrAbort ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
