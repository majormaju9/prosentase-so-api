// Simpan sebagai app/api/sql/route.ts
// Alur SIS: konteks toko -> master/user/check_user -> get_data.
// Metode GET dan empat parameter get_data ditelusuri dari modul SIS.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const base = "https://app.alfastore.co.id/prd/api/sis/"
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
}
type JsonRecord = Record<string, unknown>
function record(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function reply(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: responseHeaders })
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
  const suppliedDcId = params.get("dcId")?.trim().toUpperCase() ?? ""
  if (!/^[A-Z0-9]{1,20}$/.test(storeId) || !/^\d{1,20}$/.test(userId) ||
      !validDate(processDate) || (suppliedDcId && !/^[A-Z0-9]{1,20}$/.test(suppliedDcId))) {
    return reply({ message: "Isi storeId, userId (NIK angka), dan processDate (DD-MM-YYYY). dcId opsional; diverifikasi dari status toko." }, 400)
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "python-requests/2.28.2",
    "Api-Key": process.env.ALFASTORE_API_KEY?.trim() || "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
    "App-Name": "InventoryIntelligence",
    Platform: "ANDROID",
    "Store-Id": storeId,
    "User-Id": userId,
    // Tetap mengikuti konfigurasi yang diberikan; Branch-Id terpisah dari dcId.
    "Branch-Id": process.env.ALFA_BRANCH_ID?.trim() || "MZ01",
  }
  const signal = AbortSignal.timeout(25_000)
  let stage = "status_toko"
  let dcId: string | null = null
  let storeVerified = false
  let userVerified = false

  async function get(path: string, query: Record<string, string>) {
    const url = new URL(path, base)
    url.search = new URLSearchParams(query).toString()
    const upstream = await fetch(url, {
      method: "GET", headers, cache: "no-store", redirect: "error", signal,
    })
    const raw = await upstream.text()
    let payload: unknown = null
    let json = false
    if (raw.trim()) {
      try { payload = JSON.parse(raw); json = true } catch { /* Tetap error; jangan render HTML. */ }
    }
    return { status: upstream.status, ok: upstream.ok, payload, json, empty: !raw.trim() }
  }
  function failure(result: Awaited<ReturnType<typeof get>>, fallback: string) {
    const message = record(result.payload) && typeof result.payload.message === "string"
      ? result.payload.message : fallback
    return reply({
      message,
      source: "alfastore", stage, upstreamStatus: result.status,
      requestParameters: { storeId, userId, processDate, dcId: dcId ?? suppliedDcId },
      checks: { storeVerified, userVerified },
      hint: stage === "get_data" && storeVerified && userVerified
        ? "Status toko, kode DC, dan NIK telah diverifikasi. Endpoint data setoran tetap gagal. Periksa tanggal/transaksi yang sama di SIS; laporkan kode AHO untuk diagnosis backend. Tanggal tidak diubah otomatis."
        : "Pemeriksaan berhenti pada tahap yang tercantum. Periksa pesan upstream dan konfigurasi akses layanan SIS.",
    }, result.ok || result.status < 400 ? 502 : result.status)
  }

  try {
    const store = await get("master/status_toko/", { storeId })
    if (!store.ok || !store.json || !record(store.payload)) {
      return failure(store, "Tidak dapat membaca status toko dari Alfastore.")
    }
    if (store.payload.storeId !== storeId || typeof store.payload.dcId !== "string" ||
        !/^[A-Z0-9]{1,20}$/.test(store.payload.dcId.trim().toUpperCase())) {
      return failure(store, "Respons status toko tidak memuat storeId/dcId yang sesuai.")
    }
    dcId = store.payload.dcId.trim().toUpperCase()
    storeVerified = true
    if (suppliedDcId && suppliedDcId !== dcId) {
      return reply({
        message: "dcId pada URL berbeda dengan kode DC dari status toko. Gunakan expectedDcId atau hapus parameter dcId agar otomatis.",
        storeId, suppliedDcId, expectedDcId: dcId,
      }, 400)
    }

    stage = "check_user"
    const user = await get("master/user/check_user", { storeId, userId })
    if (!user.ok || !user.json || !record(user.payload) ||
        typeof user.payload.name !== "string" || !user.payload.name.trim()) {
      return failure(user, "Pemeriksaan NIK gagal atau nama kasir tidak tersedia.")
    }
    userVerified = true

    stage = "get_data"
    const result = await get("proses/hitung_setoran_sementara/get_data", {
      storeId, userId, dcId, processDate,
    })
    if (result.status === 204 || result.status === 205) {
      return new Response(null, { status: result.status, headers: responseHeaders })
    }
    if (!result.ok || !result.json) {
      return failure(result, result.empty ? "Respons data setoran kosong." : "Respons data setoran bukan JSON.")
    }
    if (record(result.payload) && typeof result.payload.message === "string" &&
        /\bAHO\b|server sedang bermasalah/i.test(result.payload.message)) {
      return failure(result, "Pengambilan data setoran gagal.")
    }
    return reply(result.payload, result.status)
  } catch (cause) {
    const timeout = signal.aborted || (cause instanceof Error && cause.name === "TimeoutError")
    return reply({
      message: timeout ? "Waktu tunggu layanan SIS habis." : "Layanan SIS tidak dapat dihubungi.",
      stage, checks: { storeVerified, userVerified },
    }, timeout ? 504 : 502)
  }
}
