import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TARGET_URL = "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";
const ENV_HEADERS: Record<string, string> = {
  ALFA_USER_ID: "User-Id", ALFA_IP_ADDR: "Ip-Addr",
  ALFA_API_KEY: "Api-Key", ALFA_ANDROID_ID: "AndroidId",
  ALFA_BRANCH_ID: "Branch-Id",
};
function reply(value: Record<string, unknown>, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
function decode(raw: string): any {
  let value: any = raw;
  for (let i = 0; i < 5 && typeof value === "string"; i++) {
    try { value = JSON.parse(value); } catch { break; }
  }
  return value;
}
function getMessage(value: any, depth = 0): string {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";
  for (const key of ["infoMsg", "message", "msg", "pesan", "error", "response", "data"]) {
    const found = getMessage(value[key], depth + 1);
    if (found) return found;
  }
  return "";
}
function hasFailure(value: any, depth = 0): boolean {
  if (depth > 5 || value == null) return false;
  if (typeof value === "string") return /\b(gagal|tidak berhasil|tidak ada data disimpan|not saved|unsuccessful|invalid|unauthorized)\b/i.test(value);
  if (typeof value !== "object") return false;
  if (value.success === false || value.ok === false || value.saved === false) return true;
  return Object.values(value).some(v => hasFailure(v, depth + 1));
}
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return reply({ success: false, message: "Body harus berupa JSON." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ success: false, message: "Body harus berupa objek JSON." }, 400);
  const url = new URL(req.url);
  const kodeToko = String(body.kodeToko || body.storeId || url.searchParams.get("storeId") || "").trim().toUpperCase();
  const dateSo = String(body.dateSo || body.date || url.searchParams.get("dateSo") || "").trim();
  const rakSo = String(body.rakSo || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(kodeToko)) return reply({ success: false, message: "Kode toko harus 4 huruf/angka." }, 400);
  const parts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateSo);
  const dt = parts ? new Date(`${parts[3]}-${parts[2]}-${parts[1]}T00:00:00Z`) : null;
  if (!parts || !dt || !Number.isFinite(dt.getTime()) || dt.getUTCDate() !== Number(parts[1]) || dt.getUTCMonth() + 1 !== Number(parts[2]) || dt.getUTCFullYear() !== Number(parts[3])) return reply({ success: false, message: "dateSo harus tanggal valid DD-MM-YYYY." }, 400);
  if (!rakSo || rakSo.length > 120) return reply({ success: false, message: "rakSo wajib diisi dan maksimal 120 karakter." }, 400);
  if (!Array.isArray(body.data) || !body.data.length || body.data.length > 5000) return reply({ success: false, message: "data harus berisi 1–5000 barang." }, 400);
  const data: any[] = [];
  for (const item of body.data) {
    if (!item || typeof item !== "object" || !/^\d{1,15}$/.test(String(item.plu)) || !/^\d+$/.test(String(item.qty)) || !Number.isSafeInteger(Number(item.qty))) return reply({ success: false, message: "PLU atau QTY barang tidak valid." }, 400);
    const row: any = { plu: Number(item.plu), descp: String(item.descp ?? ""), barcode: String(item.barcode ?? ""), tag: String(item.tag ?? ""), qty: String(item.qty) };
    for (const field of ["conv1", "conv2", "subdept", "avg_cost"]) {
      const number = Number(item[field] ?? 0);
      if (!Number.isFinite(number)) return reply({ success: false, message: `${field} harus berupa angka.` }, 400);
      row[field] = number;
    }
    data.push(row);
  }
  const missing = Object.keys(ENV_HEADERS).filter(name => !process.env[name]?.trim());
  if (missing.length) return reply({ success: false, source: "configuration", message: `Konfigurasi Vercel belum lengkap: ${missing.join(", ")}. Isi dengan data akses Alfastore yang valid lalu redeploy.` }, 503);
  const headers: Record<string, string> = {
    Accept: "application/json", "Content-Type": "application/json; charset=utf-8",
    "App-Name": "SO-PDA", "Version-App": "V.2026.04.13.01-alfa", "Version-Code": "28",
    "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 15)", "Store-Id": kodeToko, Platform: "ANDROID",
  };
  for (const [env, header] of Object.entries(ENV_HEADERS)) headers[header] = process.env[env]!.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    // Satu kali pengiriman. Tidak ada retry otomatis pada operasi simpan.
    const response = await fetch(TARGET_URL, { method: "POST", headers, body: JSON.stringify({ kodeToko, dateSo, rakSo, data }), cache: "no-store", redirect: "manual", signal: controller.signal });
    const decoded = decode(await response.text());
    let detail = getMessage(decoded).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    for (const name of Object.keys(ENV_HEADERS)) detail = detail.split(process.env[name]!.trim()).join("[disamarkan]");
    detail = detail.slice(0, 700);
    const failed = hasFailure(decoded);
    const active = /\b(route|api)\b.*\baktif\b/i.test(detail) || decoded?.active === true;
    const confirmed = !failed && !active && (decoded?.saved === true || decoded?.success === true || /^(berhasil\s+simpan\s+entry\s+kkso|simpan\s+entry\s+kkso\s+berhasil)[.!]?$/i.test(detail));
    const success = response.ok && confirmed;
    const message = success ? "Berhasil Simpan Entry KKSO" : `Alfastore HTTP ${response.status}: ${detail || "Server tidak memberikan pesan yang dapat dibaca."}${response.ok && !failed ? " Penyimpanan belum terkonfirmasi." : ""}`;
    // Pesan tingkat atas dapat langsung dibaca index.php. Jangan bocorkan payload/header.
    return reply({ success, saved: success, source: "alfastore", status: response.status, message, storeId: kodeToko, dateSo, rakSo, jumlahItem: data.length }, success ? 200 : response.status >= 400 ? response.status : 502);
  } catch {
    return reply({ success: false, saved: false, source: "transport", message: "Respons Alfastore tidak diterima atau tidak lengkap. Status simpan belum pasti. Periksa data rak sebelum mengirim ulang." }, 504);
  } finally { clearTimeout(timer); }
}
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return reply({ success: true, active: true, saved: false, api: "simpan", method: "POST", storeId: url.searchParams.get("storeId") || "", dateSo: url.searchParams.get("dateSo") || "", message: "Route aktif. Gunakan POST untuk simpan entry. Ini bukan konfirmasi data tersimpan." });
}
