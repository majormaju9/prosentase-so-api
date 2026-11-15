export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint SIS: Label Price - Check Perubahan Harga.
const UPSTREAM_URL =
  "https://app.alfastore.co.id/prd/api/laporan/label_price/check_perubahan_harga";

// Semua header aplikasi ada di file ini, tanpa Environment Variables.
// PENTING: Api-Key bersifat rahasia. Jangan publikasikan file ini.
const API_KEY = "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function error(message: string, status: number, upstreamStatus?: number) {
  return Response.json(
    {
      message,
      ...(upstreamStatus !== undefined ? { upstreamStatus } : {}),
    },
    { status, headers: RESPONSE_HEADERS }
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const storeId = (params.get("storeId") || "").trim().toUpperCase();
  // Nilai default User-Id dan Branch-Id diambil dari gambar, bukan hasil verifikasi toko M604.
  const userId = (params.get("userId") || "20020884").trim();
  const branchId = (params.get("branchId") || "MZ01").trim().toUpperCase();

  if (!/^[A-Z0-9]{3,12}$/.test(storeId)) {
    return error("storeId wajib diisi, contoh: M604.", 400);
  }
  if (!/^\d{1,12}$/.test(userId)) {
    return error("userId harus berisi angka.", 400);
  }
  if (!/^[A-Z0-9]{2,12}$/.test(branchId)) {
    return error("branchId tidak valid.", 400);
  }

  const upstreamUrl = new URL(UPSTREAM_URL);
  upstreamUrl.searchParams.set("storeId", storeId);

  // Semua header permintaan berada di dalam route.ts.
  const upstreamHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "python-requests/2.28.2",
    "Api-Key": API_KEY,
    "App-Name": "InventoryIntelligence",
    Platform: "ANDROID",
    "Store-Id": storeId,
    "User-Id": userId,
    "Branch-Id": branchId,
    // Host, Connection dan Accept-Encoding otomatis dikelola Node.js fetch.
  };

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });

    if (response.status >= 300 && response.status < 400) {
      return error("Server SIS mengalihkan permintaan. Periksa autentikasi.", 502, response.status);
    }

    const raw = await response.text();
    try {
      const payload = JSON.parse(raw);
      return Response.json(payload, {
        status: response.status,
        headers: RESPONSE_HEADERS,
      });
    } catch {
      return error(
        "Respons SIS bukan JSON; periksa endpoint, autentikasi, dan hak akses toko.",
        502,
        response.status
      );
    }
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Koneksi ke server SIS melewati batas waktu.", 504);
    }
    return error("Gagal terhubung ke server SIS.", 502);
  }
}
