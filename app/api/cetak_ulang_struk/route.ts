export const runtime = "nodejs";

const endpoint = "https://app.alfastore.co.id/prd/api/pos/transaksi/retur/get_transaction";
const headers = {
  "Content-Type": "application/json",
  Accept: "text/html,application/json,*/*",
  "User-Agent": "python-requests/2.28.2",
  "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
  "App-Name": "InventoryIntelligence",
  Platform: "ANDROID",
  "Store-Id": "M604",
  "User-Id": process.env.ALFA_USER_ID?.trim() || "20020884",
  "Branch-Id": process.env.ALFA_BRANCH_ID?.trim() || "MZ01",
};

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return reply({
    status: "route_aktif",
    storeId: headers["Store-Id"],
    message: "Untuk mencari struk, gunakan formulir web atau kirim POST dengan JSON.",
    method: "POST",
    fields: ["userId", "billNo", "dateTx"],
  });
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const userId = typeof input?.userId === "string" ? input.userId.trim() : "";
  const bill = typeof input?.billNo === "string" || typeof input?.billNo === "number"
    ? String(input.billNo).trim()
    : "";
  const billNo = Number(bill);
  const dateTx = typeof input?.dateTx === "string" ? input.dateTx.trim() : "";
  const date = new Date(dateTx);

  if (!/^\d{1,20}$/.test(userId)) {
    return reply({ error: "Masukkan NIK kasir dalam format angka." }, 400);
  }
  if (!/^\d+$/.test(bill) || !Number.isInteger(billNo) || billNo < 1 || billNo > 2147483647) {
    return reply({ error: "Masukkan nomor bon yang valid." }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTx) || !Number.isFinite(date.getTime())
      || date.toISOString().slice(0, 10) !== dateTx) {
    return reply({ error: "Masukkan tanggal transaksi yang valid." }, 400);
  }
  if (input?.storeId !== undefined && input.storeId !== headers["Store-Id"]) {
    return reply({ error: "Konfigurasi API ini menggunakan toko M604." }, 400);
  }

  const transaction = { storeId: headers["Store-Id"], userId, billNo, dateTx };
  const signal = AbortSignal.timeout(15000);

  let upstream: Response;
  let raw: string;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(transaction),
      cache: "no-store",
      redirect: "manual",
      signal,
    });
    raw = (await upstream.text()).trim();
  } catch {
    return signal.aborted
      ? reply({ error: "Alfastore terlalu lama merespons.", code: "UPSTREAM_TIMEOUT" }, 504)
      : reply({ error: "Vercel gagal terhubung ke server Alfastore.", code: "UPSTREAM_CONNECTION" }, 502);
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    return reply({
      error: "Alfastore mengalihkan permintaan. Periksa URL API dan akses toko M604.",
      code: "UPSTREAM_REDIRECT", upstreamStatus: upstream.status,
    }, 502);
  }

  const marker = /^(\d{1,3})\^/.exec(raw);
  const upstreamStatus = upstream.ok && marker ? Number(marker[1]) : upstream.status;
  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return reply({
      error: "Alfastore menolak akses M604. Periksa Api-Key, User-Id, dan Branch-Id untuk toko ini.",
      code: "UPSTREAM_ACCESS", upstreamStatus,
    }, 502);
  }
  if (!upstream.ok || (marker && upstreamStatus !== 200)) {
    return reply({
      error: "Alfastore mengembalikan kesalahan saat mencari struk.",
      code: "UPSTREAM_STATUS", upstreamStatus,
    }, 502);
  }

  const payload = marker ? raw.slice(marker[0].length).trim() : raw;
  if (upstreamStatus === 204) return reply({ transaction, items: [] });
  if (!payload || payload.startsWith("<")) {
    return reply({
      error: payload
        ? "Alfastore mengembalikan halaman HTML. Periksa akses API toko M604."
        : "Alfastore mengirim respons kosong.",
      code: payload ? "UPSTREAM_HTML" : "UPSTREAM_EMPTY", upstreamStatus,
    }, 502);
  }

  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    return reply({
      error: "Isi respons Alfastore tidak dapat dibaca sebagai JSON.",
      code: "UPSTREAM_JSON", upstreamStatus,
    }, 502);
  }
  const items: unknown = Array.isArray(data) ? data : data?.data?.items ?? data?.items ?? data?.data;
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    return reply({
      error: "Respons Alfastore tidak berbentuk daftar barang struk.",
      code: "UPSTREAM_ITEMS", upstreamStatus,
    }, 502);
  }
  return reply({ transaction, items });
}
