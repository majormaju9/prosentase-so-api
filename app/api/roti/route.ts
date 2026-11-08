// Simpan sebagai: app/api/roti/route.ts
// Next.js App Router / Vercel.
// Header dari HTTP Request ditulis langsung di server, TANPA environment variables.
// PENTING: Jangan import file ini ke client atau unggah ke repositori publik.
//
// GET /api/roti?kodeToko=M604&dateSo=19-10-2026&dcId=ISI_DC_ID&typeSo=ISI_TYPE_SO
// -> Laporan Cetak Selisih SO per PLU (HTML/PDF/JSON sesuai API asli).
//
// GET /api/roti?kodeToko=M604&dateSo=19-10-2026&menuList=TOKO&mode=proses
// -> Hanya menjalankan process_printdifferenceso, BUKAN mengambil detail.
//    Catatan: GET mode=proses dapat memicu proses di sistem sumber.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://app.alfastore.co.id/prd/api";

// Nama laporan yang diidentifikasi dari API aplikasi SO-PDA.
const REPORTS = {
  plu: "csel_all_so_all_index_subdept_plu",
  subdept: "csel_all_so_all_per_subdept",
  nominal: "csel_all_so_absolute_desc",
  plu_terakhir: "csel_last_so_all_index_subdept_plu",
  subdept_terakhir: "csel_last_so_all_per_subdept",
  nominal_terakhir: "csel_last_so_absolute_desc",
} as const;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const input = new URL(request.url);
  const kodeToko = input.searchParams.get("kodeToko")?.trim() || "M604";
  const dateSo = input.searchParams.get("dateSo")?.trim() || "19-10-2026";
  const menuList = input.searchParams.get("menuList")?.trim() || "TOKO";
  const mode = input.searchParams.get("mode")?.trim().toLowerCase() || "laporan";
  const dcId = input.searchParams.get("dcId")?.trim() || "";
  const typeSo = input.searchParams.get("typeSo")?.trim() || "";
  const report = input.searchParams.get("report")?.trim() || "plu";

  if (!/^[a-zA-Z0-9_-]{1,24}$/.test(kodeToko) || !/^\d{2}-\d{2}-\d{4}$/.test(dateSo)) {
    return json({ success: false, message: "kodeToko atau dateSo tidak valid (format tanggal DD-MM-YYYY)." }, 400);
  }
  if (mode !== "laporan" && mode !== "proses") {
    return json({ success: false, message: "mode hanya boleh laporan atau proses." }, 400);
  }

  let upstreamUrl: URL;
  if (mode === "proses") {
    upstreamUrl = new URL(`${BASE}/so/cetak_selisih/process_printdifferenceso`);
    upstreamUrl.searchParams.set("kodeToko", kodeToko);
    upstreamUrl.searchParams.set("dateSo", dateSo);
    upstreamUrl.searchParams.set("menuList", menuList);
  } else {
    // Endpoint report ini memang memerlukan dcId & typeSo; st_type:null
    // dari process_printdifferenceso TIDAK berarti typeSo telah diketahui.
    if (!dcId || !typeSo) {
      return json({
        success: false,
        message: "Laporan detail memerlukan dcId dan typeSo sesuai sesi/menu SO-PDA. Kedua nilai tersebut belum tersedia dari respons 'Data Ditemukan'.",
        required: ["dcId", "typeSo"],
        availableReports: Object.keys(REPORTS),
        example: `/api/roti?kodeToko=${encodeURIComponent(kodeToko)}&dateSo=${encodeURIComponent(dateSo)}&dcId=ISI_DC_ID&typeSo=ISI_TYPE_SO&report=plu`,
        note: "Nilai dcId/typeSo harus berasal dari data aplikasi atau request report aslinya; tidak ditebak. mode=proses hanya menyiapkan laporan.",
      }, 422);
    }
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(dcId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(typeSo)) {
      return json({ success: false, message: "dcId atau typeSo tidak valid." }, 400);
    }
    if (!(report in REPORTS)) {
      return json({ success: false, message: "Jenis report tidak dikenal.", availableReports: Object.keys(REPORTS) }, 400);
    }
    upstreamUrl = new URL(`${BASE}/rpt/laporan_so/${REPORTS[report as keyof typeof REPORTS]}`);
    upstreamUrl.searchParams.set("storeId", kodeToko);
    upstreamUrl.searchParams.set("dateSo", dateSo);
    upstreamUrl.searchParams.set("dcId", dcId);
    upstreamUrl.searchParams.set("typeSo", typeSo);
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: {
        "App-Name": "SO-PDA",
        "Version-App": "V.2026.04.13.01-alfa",
        "Version-Code": "28",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
        "App-Uid": "",
        "User-Id": "17010230",
        "Store-Id": kodeToko,
        "Store-Id-Ext": "",
        "Shard-Id": "",
        "Ip-Addr": "10.1.10.1",
        "Sn": "",
        "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
        "AndroidId": "712f8db18eeb1816",
        "Branch-Id": "MZ01",
        "Class-Store": "",
        "Company-Id": "",
        "Company-Ext": "",
        "Platform": "ANDROID",
        "Mac-Addr": "712f8db18eeb1816",
        "Accept": "application/json, text/html, application/pdf, */*",
      },
      // Host, Connection, dan Content-Length diatur otomatis oleh fetch.
    });

    // Jangan mengubah respons asli: report kemungkinan HTML atau PDF,
    // bukan JSON berisi daftar PLU. Status error upstream tetap diteruskan.
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);
    // HTML pihak ketiga tidak boleh menjalankan skrip pada domain Vercel Anda.
    if ((upstream.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
      headers.set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:");
    }
    if (upstream.status === 204 || upstream.status === 304) {
      return new Response(null, { status: upstream.status, headers });
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return json({
      success: false,
      message: "Gagal mengambil laporan Cetak Selisih SO dari API sumber.",
      error: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}
