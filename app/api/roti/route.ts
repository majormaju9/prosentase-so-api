// Simpan di: app/api/so/cetak_selisih/process_printdifferenceso/route.ts
// Endpoint dan header ditulis langsung tanpa .env / environment variables.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(
      "https://app.alfastore.co.id/prd/api/so/cetak_selisih/process_printdifferenceso?kodeToko=M604&dateSo=19-10-2026&menuList=TOKO",
      {
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
          "Store-Id": "M604",
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
          "Accept": "*/*",
        },
        // Host, Connection, dan Accept-Encoding diatur otomatis oleh fetch.
      }
    );

    // Biarkan respons asli (JSON, teks, HTML, atau PDF) tetap utuh.
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) headers.set("Content-Disposition", disposition);

    if (upstream.status === 204 || upstream.status === 304) {
      return new Response(null, { status: upstream.status, headers });
    }

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Gagal menghubungi API cetak selisih SO.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
