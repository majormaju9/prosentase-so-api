export const runtime = "nodejs";

const endpoint = "https://app.alfastore.co.id/prd/api/pos/transaksi/retur/get_transaction";
const headers = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "python-requests/2.28.2",
  "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
  "App-Name": "InventoryIntelligence",
  Platform: "ANDROID",
  "Store-Id": "M865",
  "User-Id": "20020884",
  "Branch-Id": "MZ01",
};

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
    return reply({ error: "Konfigurasi API ini menggunakan toko M865." }, 400);
  }

  const transaction = { storeId: headers["Store-Id"], userId, billNo, dateTx };
  const signal = AbortSignal.timeout(15000);

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(transaction),
      cache: "no-store",
      redirect: "error",
      signal,
    });

    if (!upstream.ok) {
      const status = upstream.status;
      const message = status === 401 || status === 403
        ? "Alfastore menolak kredensial atau akses untuk transaksi ini."
        : "Alfastore gagal memproses permintaan struk.";
      return reply({ error: message, upstreamStatus: status }, 502);
    }

    // THOR accepts an array and uses the same 200^ marker in its HTTP helper.
    const raw = (await upstream.text()).trim();
    const marker = /^(\d{3})\^/.exec(raw);
    if (marker && marker[1] !== "200") {
      return reply({ error: "Alfastore mengembalikan kesalahan transaksi.", upstreamStatus: Number(marker[1]) }, 502);
    }
    const items: unknown = JSON.parse(marker ? raw.slice(marker[0].length).trim() : raw);
    if (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
      return reply({ error: "Respons Alfastore tidak berbentuk daftar barang." }, 502);
    }
    return reply({ transaction, items });
  } catch {
    if (signal.aborted) {
      return reply({ error: "Alfastore terlalu lama merespons. Coba lagi." }, 504);
    }
    return reply({ error: "Gagal membaca respons dari Alfastore." }, 502);
  }
}
