export const runtime = "nodejs"

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
      !validDate(processDate) || !/^[A-Z0-9_-]+$/.test(dcId) || dcId === "KODE_DC") {
    return error("Isi storeId, userId (NIK), dcId, dan processDate (DD-MM-YYYY).", 400)
  }

  const upstreamHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "app-name": "SIS",
    platform: "win",
    "version-app": process.env.SIS_VERSION_APP?.trim() || "V.2025.9.4",
    "version-code": process.env.SIS_VERSION_CODE?.trim() || "202594",
    "store-id": storeId,
    "branch-id": process.env.SIS_BRANCH_ID?.trim(),
    "shard-id": process.env.SIS_SHARD_ID?.trim(),
    "company-id": process.env.SIS_COMPANY_ID?.trim(),
    "Api-Key": process.env.SIS_API_KEY?.trim(),
    "session-id": process.env.SIS_SESSION_ID?.trim(),
    "public-key": process.env.SIS_PUBLIC_KEY?.trim(),
    "mac-addr": process.env.SIS_MAC_ADDR?.trim(),
    "ip-address": process.env.SIS_IP_ADDRESS?.trim(),
  }

  if (!upstreamHeaders["Api-Key"] || !upstreamHeaders["session-id"] ||
      !upstreamHeaders["branch-id"] || !upstreamHeaders["shard-id"]) {
    return error("Konfigurasi SISA belum lengkap. Isi SIS_API_KEY, SIS_SESSION_ID, SIS_BRANCH_ID, dan SIS_SHARD_ID di server.", 503)
  }

  const headers = new Headers()
  for (const [name, value] of Object.entries(upstreamHeaders)) {
    if (value) headers.set(name, value)
  }

  const upstreamUrl = new URL(endpoint)
  upstreamUrl.search = new URLSearchParams({ storeId, userId, dcId, processDate }).toString()

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers,
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
        { message: "Respons Hitung Setoran Sementara dari Alfastore bukan JSON.", upstreamStatus: upstream.status },
        { status: upstream.ok ? 502 : upstream.status, headers: responseHeaders },
      )
    }

    if (!upstream.ok) {
      const response = await upstream.json().catch(() => null)
      const message = typeof response?.message === "string"
        ? response.message
        : "API Hitung Setoran Sementara mengembalikan error."
      return Response.json(
        { message, upstreamStatus: upstream.status },
        { status: upstream.status, headers: responseHeaders },
      )
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...responseHeaders, "Content-Type": contentType, "X-Content-Type-Options": "nosniff" },
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Waktu tunggu API Hitung Setoran Sementara habis.", 504)
    }
    return error("API Hitung Setoran Sementara Alfastore tidak dapat dihubungi.", 502)
  }
}
