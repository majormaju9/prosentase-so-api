/**
 * Simpan sebagai app/api/simpan/route.ts (Next.js App Router).
 * Environment server:
 * ALFA_API_KEY     = Api-Key dari request aplikasi Anda
 * ALFA_ANDROID_ID  = AndroidId dari request aplikasi Anda
 * ALFA_BRANCH_ID   = Branch-Id dari request aplikasi Anda
 * ALFA_MAC_ADDR opsional, default sama dengan ALFA_ANDROID_ID.
 * Gunakan autentikasi/otorisasi aplikasi Anda untuk melindungi endpoint ini.
 * POST JSON: { kodeToko, dateSo: "29-09-2026", rakSo, data: [...] }
 * storeId dan dateSo pada query URL juga diterima sebagai fallback.
 * GET hanya petunjuk; tidak menyimpan. Tidak ada retry otomatis.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET = "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";
type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function fail(message: string, status = 400) {
  return json({ success: false, message }, status);
}
function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function validDate(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const [, d, m, y] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() + 1 === Number(m)
    && date.getUTCDate() === Number(d);
}

export async function GET() {
  return json({ message: "Gunakan POST JSON untuk menyimpan entry KKSO.", method: "POST",
    required: ["kodeToko", "dateSo (DD-MM-YYYY)", "rakSo", "data"] });
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return fail("Body harus JSON yang valid."); }
  if (!isObject(body)) return fail("Body harus berupa object JSON.");

  const query = new URL(req.url).searchParams;
  const kodeToko = string(body.kodeToko ?? body.storeId ?? query.get("storeId")).toUpperCase();
  const dateSo = string(body.dateSo ?? body.date ?? query.get("dateSo"));
  const rakSo = string(body.rakSo).toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(kodeToko)) return fail("kodeToko harus 4 huruf/angka.");
  if (!validDate(dateSo)) return fail("dateSo harus tanggal valid dengan format DD-MM-YYYY.");
  if (!rakSo) return fail("rakSo wajib diisi.");
  if (!Array.isArray(body.data) || body.data.length === 0) return fail("data harus array berisi minimal satu barang.");

  const data: Obj[] = [];
  for (const [index, item] of body.data.entries()) {
    const prefix = `data[${index}]`;
    if (!isObject(item)) return fail(`${prefix} harus object.`);
    for (const key of ["plu", "conv1", "conv2", "subdept", "avg_cost"]) {
      if (typeof item[key] !== "number" || !Number.isFinite(item[key])) {
        return fail(`${prefix}.${key} harus angka JSON yang valid.`);
      }
    }
    if (!Number.isInteger(item.plu) || Number(item.plu) <= 0) return fail(`${prefix}.plu tidak valid.`);
    for (const key of ["descp", "barcode", "tag"]) {
      if (typeof item[key] !== "string") return fail(`${prefix}.${key} harus string.`);
    }
    // Qty 0 tetap dikirim. Qty kosong tidak boleh diam-diam diubah menjadi 0.
    if ((typeof item.qty !== "string" && typeof item.qty !== "number") ||
      !/^-?\d+(?:\.\d+)?$/.test(String(item.qty).trim()) || !Number.isFinite(Number(item.qty))) {
      return fail(`${prefix}.qty wajib berisi angka.`);
    }
    data.push({ plu: item.plu, descp: item.descp, conv1: item.conv1, conv2: item.conv2,
      subdept: item.subdept, barcode: item.barcode, tag: item.tag,
      qty: String(item.qty).trim(), avg_cost: item.avg_cost });
  }

  const apiKey = process.env.ALFA_API_KEY?.trim();
  const androidId = process.env.ALFA_ANDROID_ID?.trim();
  const branchId = process.env.ALFA_BRANCH_ID?.trim();
  if (!apiKey || !androidId || !branchId) {
    return fail("Isi environment ALFA_API_KEY, ALFA_ANDROID_ID, dan ALFA_BRANCH_ID di server.", 500);
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Api-Key": apiKey, AndroidId: androidId, "Branch-Id": branchId,
    Platform: "ANDROID", "Mac-Addr": process.env.ALFA_MAC_ADDR?.trim() || androidId,
    Sn: "", "Class-Store": "", "Company-Id": "", "Company-Ext": "",
  };
  // Header tambahan hanya diisi jika memang tersedia dari request asli.
  for (const [env, name] of Object.entries({ ALFA_USER_ID: "User-Id", ALFA_IP_ADDR: "Ip-Addr",
    ALFA_SN: "Sn", ALFA_CLASS_STORE: "Class-Store", ALFA_COMPANY_ID: "Company-Id",
    ALFA_COMPANY_EXT: "Company-Ext" })) {
    const value = process.env[env]?.trim();
    if (value) headers[name] = value;
  }
  // Host, Content-Length, Connection, dan kompresi diatur otomatis oleh fetch.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const upstream = await fetch(TARGET, {
      method: "POST", headers, body: JSON.stringify({ kodeToko, dateSo, rakSo, data }),
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    const raw = await upstream.text();
    // Teruskan status dan body asli: contoh 201 + { infoMsg: "Berhasil Simpan Entry KKSO" }.
    // Tidak mengubah HTTP 406/401/500 menjadi sukses.
    return new Response([204, 205, 304].includes(upstream.status) ? null : raw, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "no-store" },
    });
  } catch {
    return fail(controller.signal.aborted
      ? "Waktu tunggu habis. Status simpan belum diketahui; cek data sebelum mengirim ulang."
      : "Koneksi ke server gagal. Status simpan belum diketahui; cek data sebelum mengirim ulang.",
      controller.signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
