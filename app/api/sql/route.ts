// Simpan sebagai app/api/sql/route.ts
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Diasumsikan memakai layanan SIS untuk get_data; endpoint belum diuji langsung.
const endpoint = "https://app.alfastore.co.id/prd/api/sis/proses/hitung_setoran_sementara/get_data"
const responseHeaders = { "Cache-Control": "private, no-store" }

function error(message: string, status: number) {
  return Response.json({ message }, { status, headers: responseHeaders })
}

function validDate(value: string) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return false
  const [day, month, year] = value.split("-")
  const iso = `${year}-${month}-${day}`
  const date = new Date(iso)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const storeId = params.get("storeId")?.trim().toUpperCase() ?? ""
  const userId = params.get("userId")?.trim() ?? ""
  const processDate = params.get("processDate")?.trim() ?? ""
  const dcId = params.get("dcId")?.trim().toUpperCase() ?? ""

  if (!/^[A-Z0-9]+$/.test(storeId) || !/^\d+$/.test(userId) ||
      !validDate(processDate) || !/^[A-Z0-9]+$/.test(dcId)) {
    return error("Isi storeId, userId (NIK angka), processDate (DD-MM-YYYY), dan dcId (kode DC).", 400)
  }

  const upstreamUrl = new URL(endpoint)
  upstreamUrl.search = new URLSearchParams({ storeId, userId, processDate, dcId }).toString()

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, application/pdf, */*",
        "User-Agent": "python-requests/2.28.2",
        "Api-Key": process.env.ALFASTORE_API_KEY?.trim() || "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
        "App-Name": "InventoryIntelligence",
        Platform: "ANDROID",
        "Store-Id": storeId,
        "User-Id": userId,
        // Mengikuti contoh pengguna; Branch-Id tidak otomatis sama dengan dcId.
        "Branch-Id": process.env.ALFA_BRANCH_ID?.trim() || "MZ01",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    })

    if (upstream.status === 204 || upstream.status === 205) {
      return new Response(null, { status: upstream.status, headers: responseHeaders })
    }

    // get_data diharapkan menghasilkan JSON. Jangan meneruskan halaman HTML
    // sebagai data sukses atau menyembunyikan pesan AHO dari upstream.
    const raw = await upstream.text()
    if (!raw.trim()) {
      return Response.json({
        message: "API Alfastore mengembalikan respons kosong.",
        upstreamStatus: upstream.status,
      }, { status: upstream.ok ? 502 : upstream.status, headers: responseHeaders })
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return Response.json({
        message: "Respons API setoran sementara bukan JSON.",
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get("content-type"),
        hint: "Periksa endpoint SIS, autentikasi, dan respons upstream. HTML tidak ditampilkan sebagai data setoran.",
      }, { status: upstream.ok ? 502 : upstream.status, headers: responseHeaders })
    }

    const message = payload !== null && typeof payload === "object" &&
      "message" in payload && typeof payload.message === "string" ? payload.message : ""
    if (/\bAHO\b|server sedang bermasalah/i.test(message)) {
      return Response.json({
        message,
        source: "alfastore",
        upstreamStatus: upstream.status,
        requestParameters: { storeId, userId, processDate, dcId },
        hint: "Pesan berasal dari Alfastore. Penyebab belum dapat dipastikan: verifikasi dcId toko, hak akses/header, tanggal data, dan endpoint SIS. Branch-Id tidak otomatis sama dengan dcId.",
      }, { status: upstream.ok ? 502 : upstream.status, headers: responseHeaders })
    }

    return Response.json(payload, { status: upstream.status, headers: responseHeaders })
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Waktu tunggu API setoran sementara habis.", 504)
    }
    return error("API setoran sementara Alfastore tidak dapat dihubungi.", 502)
  }
}
