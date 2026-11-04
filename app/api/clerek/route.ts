/**
 * Simpan sebagai app/api/backup-data-transaksi/route.ts
 * POST /api/backup-data-transaksi?filename=NAMA_BACKUP.zip
 * Kirim body upload dan Content-Type sesuai format yang diterima API asli.
 * Body diteruskan apa adanya (tidak dikonversi ke JSON atau multipart).
 * Tidak memuat kredensial bawaan dan tidak melewati autentikasi server asal.
 * Terapkan autentikasi aplikasi Anda pada route ini sebelum dipublikasikan.
 */
export const runtime = "nodejs";

const ENDPOINT =
  "https://app.alfastore.co.id/prd/api/pos/transaksi/clerek/backup_data_transaksi";
const DEFAULT_FILENAME = "M604_2026-11-04_24067944_android.zip";

export async function POST(request: Request): Promise<Response> {
  const filename = new URL(request.url).searchParams.get("filename") ?? DEFAULT_FILENAME;

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,195}\.zip$/i.test(filename)) {
    return Response.json(
      { ok: false, message: "filename harus berupa nama file .zip tanpa path." },
      { status: 400 },
    );
  }
  if (!request.body || request.headers.get("content-length") === "0") {
    return Response.json(
      { ok: false, message: "Kirim isi file backup melalui body POST." },
      { status: 400 },
    );
  }

  const target = new URL(ENDPOINT);
  target.searchParams.set("filename", filename);

  const headers = new Headers();
  // Hanya header terkait request API, bukan Cookie/Host milik situs proxy.
  for (const name of ["content-type", "accept", "authorization", "x-api-key", "x-store-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  try {
    // Streaming menghindari penampungan seluruh ZIP dalam memori.
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers,
      body: request.body,
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    };
    const upstream = await fetch(target, options);

    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return Response.json(
        { ok: false, message: "Server asal mengembalikan redirect; unggahan tidak diulang otomatis." },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-disposition", "retry-after", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // Pertahankan status dan respons asli, termasuk respons non-JSON.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        ok: false,
        message: timeout
          ? "Server asal tidak merespons dalam 30 detik. Periksa status backup sebelum mencoba lagi."
          : "Pengiriman ke server asal terputus atau gagal. Periksa status backup sebelum mencoba lagi.",
      },
      { status: timeout ? 504 : 502 },
    );
  }
}
