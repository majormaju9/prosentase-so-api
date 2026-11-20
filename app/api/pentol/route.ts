
/**
 * Label Price / check_input_filter – Next.js App Router, Vercel.
 * Instal di: app/api/label_price/check_input_filter/route.ts
 *
 * Dua basis URL diperoleh dari (1) URL yang diberikan pengguna dan
 * (2) string konfigurasi aplikasi SISA V.2025.9.4 (base layanan report staging).
 * Layanan staging bukan endpoint produksi terkonfirmasi.
 *
 * Environment Vercel (WAJIB): ALFASTORE_API_KEY
 * Opsional: ALFASTORE_DEFAULT_BACKEND = alfastore | sisa_report_legacy
 * Untuk eksplisit menguji SISA lama, gunakan ?backend=sisa_report_legacy.
 * Jangan menaruh API key di URL/browser/repository.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "laporan/label_price/check_input_filter";
const BACKENDS = {
  alfastore: "https://app.alfastore.co.id/prd/api/",
  // Ditemukan di modul controller/main/config dari SISA_V.2025.9.4.zip
  // Staging versi lama: keberadaan dan izin akses belum diverifikasi.
  sisa_report_legacy: "https://rpt-svc-stg-dot-sis-stagging.et.r.appspot.com/",
} as const;
type Backend = keyof typeof BACKENDS;
const APP_ROUTE = "/api/label_price/check_input_filter";
const DEFAULT_STORE = "M865";
const DEFAULT_USER = "20020884";
const DEFAULT_BRANCH = "MZ01";
const TIMEOUT_MS = 16000;

const RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: RESPONSE_HEADERS });
}
function parse(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}
function pickMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
  }
  return undefined;
}
function validDate(value: string): boolean {
  const hit = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!hit) return false;
  const [day, month, year] = hit.slice(1).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDate() === day && d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year;
}
function todayJakarta(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const val = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${val("day")}-${val("month")}-${val("year")}`;
}
function getParameter(params: URLSearchParams, body: Record<string, unknown>, key: string, fallback = ""): string {
  const input = body[key];
  return (input === undefined ? params.get(key) ?? fallback : String(input)).trim();
}
function backendFrom(value: string): Backend | null {
  return value === "alfastore" || value === "sisa_report_legacy" ? value : null;
}

async function handle(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const requestedBackend = params.get("backend") ?? process.env.ALFASTORE_DEFAULT_BACKEND ?? "alfastore";
  const backend = backendFrom(requestedBackend);
  if (!backend) return response({success:false, message:"backend tidak valid. Gunakan alfastore atau sisa_report_legacy."},400);

  if (params.get("health") === "1") {
    return response({
      success: true, message: "Route Vercel aktif", source: "vercel_route",
      path: APP_ROUTE, backendDefault: process.env.ALFASTORE_DEFAULT_BACKEND ?? "alfastore",
      backendSelected: backend, upstreamEndpoint: new URL(PATH, BACKENDS[backend]).toString(),
      configuredApiKey: !!process.env.ALFASTORE_API_KEY?.trim(),
      note: "Health check tidak memanggil layanan ALFASTORE / SISA.",
    });
  }

  const apiKey = process.env.ALFASTORE_API_KEY?.trim();
  if (!apiKey) return response({
    success:false, source:"vercel_configuration", message:"ALFASTORE_API_KEY belum disetel pada Vercel Environment Variables."
  },500);

  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      if ((req.headers.get("content-type") ?? "").includes("application/json")) {
        const v: unknown = await req.json();
        if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Bad JSON object");
        body = v as Record<string, unknown>;
      } else {
        body = Object.fromEntries(new URLSearchParams(await req.text()));
      }
    } catch {
      return response({ success: false, message: "Body POST tidak valid." }, 400);
    }
  }

  const storeId = getParameter(params, body, "storeId", DEFAULT_STORE).toUpperCase();
  const storeDate = getParameter(params, body, "storeDate", todayJakarta());
  const inputType = getParameter(params, body, "inputType", "ITEM").toUpperCase();
  const inputFilter = getParameter(params, body, "inputFilter");
  const userId = getParameter(params, body, "userId", DEFAULT_USER);
  const branchId = getParameter(params, body, "branchId", DEFAULT_BRANCH).toUpperCase();
  if (!/^[A-Z0-9]{4,10}$/.test(storeId)) return response({success:false,message:"Kode toko tidak valid."},400);
  if (!validDate(storeDate)) return response({success:false,message:"storeDate harus DD-MM-YYYY."},400);
  if (!/^[A-Z_]{1,30}$/.test(inputType)) return response({success:false,message:"inputType tidak valid."},400);
  if (!inputFilter || inputFilter.length > 100) return response({success:false,message:"inputFilter PLU/barcode wajib diisi."},400);
  if (!/^\d{1,12}$/.test(userId)) return response({success:false,message:"userId tidak valid."},400);
  if (!/^[A-Z0-9]{2,10}$/.test(branchId)) return response({success:false,message:"branchId tidak valid."},400);

  const upstream = new URL(PATH, BACKENDS[backend]);
  const paramData = {storeId, storeDate, inputType, inputFilter};
  for (const [key, value] of Object.entries(paramData)) upstream.searchParams.set(key, value);

  const baseHeaders = {
    "Accept": "application/json",
    "User-Agent": "python-requests/2.28.2",
    "Api-Key": apiKey,
    "App-Name": "InventoryIntelligence",
    "Platform": "ANDROID",
    "Store-Id": storeId,
    "User-Id": userId,
    "Branch-Id": branchId,
    "Accept-Encoding": "gzip",
    // Host dan Connection akan dikendalikan oleh fetch / Node.
  };
  type Method = "GET" | "POST_JSON" | "POST_FORM";
  const attempts: Array<{method:Method;status?:number;message?:string}> = [];
  const methods: Method[] = ["GET", "POST_JSON", "POST_FORM"];

  for (const method of methods) {
    const methodIsPost = method !== "GET";
    try {
      const upstreamRes = await fetch(upstream, {
        method: methodIsPost ? "POST" : "GET",
        headers: {
          ...baseHeaders,
          "Content-Type": method === "POST_FORM" ? "application/x-www-form-urlencoded" : "application/json",
        },
        ...(method === "POST_JSON" ? {body:JSON.stringify(paramData)} : {}),
        ...(method === "POST_FORM" ? {body:new URLSearchParams(paramData).toString()} : {}),
        cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(TIMEOUT_MS),
      });
      const raw = await upstreamRes.text();
      const decoded = parse(raw);
      const msg = pickMessage(decoded);
      attempts.push({method,status:upstreamRes.status,...(msg ? {message:msg} : {})});
      const routeMissing = upstreamRes.status === 404 || upstreamRes.status === 405 ||
        (msg && /route not found/i.test(msg));
      if (routeMissing && method !== methods[methods.length-1]) continue;

      if (routeMissing) return response({
        success:false,source:"upstream",backend,upstreamEndpoint:upstream.origin+upstream.pathname,
        message:"Backend yang dipilih masih menjawab Route not found. Periksa base URL dan versi API yang aktif.",
        params:paramData, attempts,
        note:"Path relatif ditemukan pada modul SISA lama, tetapi tidak membuktikan endpoint aktif di backend saat ini.",
      },502);
      if (!upstreamRes.ok) return response({
        success:false,source:"upstream",backend,upstreamEndpoint:upstream.origin+upstream.pathname,
        upstreamStatus:upstreamRes.status,attempts,
        message:msg ?? `HTTP ${upstreamRes.status} dari backend`,
        upstreamResponse: typeof decoded === "string" ? decoded.slice(0,1500) : decoded,
        note:"Respons bukan Route not found; periksa autentikasi, hak akses, dan parameter.",
      },upstreamRes.status === 401 || upstreamRes.status === 403 ? upstreamRes.status : 502);

      // Respons sukses dibiarkan sama seperti backend, agar kompatibel dengan klien lama.
      if (typeof decoded === "string") return response({success:true,source:"upstream",backend,data:decoded});
      return response(decoded);
    } catch (error) {
      const reason = error instanceof Error ? error.name : "RequestError";
      attempts.push({method,message:reason});
      // Timeout dan kesalahan jaringan umumnya tidak perlu dicoba lagi berkali-kali.
      return response({success:false,source:"network",backend,
        upstreamEndpoint:upstream.origin+upstream.pathname,
        message:"Tidak bisa menghubungi backend yang dipilih.",reason,attempts},502);
    }
  }
  return response({success:false,message:"Tidak ada respons backend."},502);
}

export async function GET(req:Request):Promise<Response> {return handle(req);}
export async function POST(req:Request):Promise<Response> {return handle(req);}
export async function OPTIONS():Promise<Response> {return new Response(null,{status:204,headers:RESPONSE_HEADERS});}
