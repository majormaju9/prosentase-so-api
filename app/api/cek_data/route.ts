export const runtime = "nodejs"

const endpoint = "https://app.alfastore.co.id/prd/api/sis/proses/clerek/cek_data"
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
  const clerekDate = params.get("clerekDate")?.trim() ?? ""
  const dcId = params.get("dcId")?.trim().toUpperCase() ?? ""

  if (!/^[A-Z0-9]+$/.test(storeId) || !/^\d+$/.test(userId) ||
      !validDate(clerekDate) || !/^[A-Z0-9_-]+$/.test(dcId) || dcId === "KODE_DC") {
    return error("Isi storeId, userId (NIK), clerekDate (DD-MM-YYYY), dan dcId.", 400)
  }

  const upstreamUrl = new URL(endpoint)
  upstreamUrl.search = new URLSearchParams({ storeId, userId, clerekDate, dcId }).toString()

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "python-requests/2.28.2",
        "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
        "App-Name": "InventoryIntelligence",
        Platform: "ANDROID",
        "Store-Id": storeId,
        "User-Id": userId,
        "Branch-Id": "MZ01",
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    })

    if (upstream.status === 204 || upstream.status === 205) {
      return new Response(null, { status: upstream.status, headers: responseHeaders })
    }

    const contentType = upstream.headers.get("content-type") ?? ""
    if (!/^application\/(?:json|[^;\s]+\+json)(?:\s*;|$)/i.test(contentType)) {
      await upstream.body?.cancel()
      return Response.json(
        { message: "Respons Clerek dari Alfastore bukan JSON.", upstreamStatus: upstream.status },
        { status: upstream.ok ? 502 : upstream.status, headers: responseHeaders },
      )
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...responseHeaders, "Content-Type": contentType, "X-Content-Type-Options": "nosniff" },
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Waktu tunggu API Clerek habis.", 504)
    }
    return error("API Clerek Alfastore tidak dapat dihubungi.", 502)
  }
}
