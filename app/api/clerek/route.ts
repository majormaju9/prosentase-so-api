export const runtime = "nodejs"

const endpoint = "https://app.alfastore.co.id/prd/api/rpt/proses/clerek"
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

  if (!/^[A-Z0-9]+$/.test(storeId) || !/^\d+$/.test(userId) ||
      !validDate(clerekDate)) {
    return error("Isi storeId, userId (NIK), dan clerekDate (DD-MM-YYYY).", 400)
  }

  const upstreamUrl = new URL(endpoint)
  upstreamUrl.search = new URLSearchParams({ storeId, userId, clerekDate }).toString()

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/pdf, application/json, */*",
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

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream"
    const mediaType = contentType.split(";", 1)[0].trim().toLowerCase()
    const isJson = /^application\/(?:json|[^;\s]+\+json)$/.test(mediaType)
    const headers = new Headers({
      ...responseHeaders,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    })

    if (!isJson && mediaType !== "application/pdf" && mediaType !== "text/plain") {
      // Download active formats instead of rendering them on the API origin.
      const filename = mediaType === "text/html" ? "laporan-clerek.html" : "laporan-clerek"
      headers.set("Content-Disposition", `attachment; filename="${filename}"`)
    }

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Waktu tunggu API Clerek habis.", 504)
    }
    return error("API Clerek Alfastore tidak dapat dihubungi.", 502)
  }
}
