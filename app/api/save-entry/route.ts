import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERSION = "save-entry-hydrate-v6";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

const ENTRY_SOURCE_URL =
  "https://lautanapi.vercel.app/api/entry-kkso";

function alfaHeaders(storeId: string): Record<string, string> {
  return {
    Accept: "application/json",
    "App-Name": "SO-PDA",
    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
    "Version-App": "V.2026.04.13.01-alfa",
    "Version-Code": "28",
    "App-Uid": "",
    "User-Id": "23067884",
    "Store-Id": storeId,
    "Store-Id-Ext": "",
    "Shard-Id": "",
    "Ip-Addr": "10.1.10.1",
    Sn: "",
    "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
    AndroidId: "712f8db18eeb1816",
    "Branch-Id": "MZ01",
    "Class-Store": "",
    "Company-Id": "",
    "Company-Ext": "",
    Platform: "ANDROID",
    "Mac-Addr": "712f8db18eeb1816",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function keyNorm(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(obj: any, names: string[], fallback: any = undefined): any {
  if (!obj || typeof obj !== "object") return fallback;

  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }

  const wanted = new Set(names.map(keyNorm));
  for (const [k, v] of Object.entries(obj)) {
    if (wanted.has(keyNorm(k)) && v !== undefined && v !== null) return v;
  }

  return fallback;
}

function findRows(value: any, depth = 0): any[] | null {
  if (depth > 10 || value == null) return null;

  if (Array.isArray(value)) {
    const objectRows = value.filter(
      (x) => x && typeof x === "object" && !Array.isArray(x)
    );

    if (
      objectRows.length > 0 &&
      objectRows.some((x) =>
        pick(x, ["plu", "PLU", "kodePlu", "kode_plu", "kodebarang"], null) !== null
      )
    ) {
      return objectRows;
    }

    for (const x of value) {
      const rows = findRows(x, depth + 1);
      if (rows) return rows;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const k of ["data", "result", "results", "items", "rows", "response"]) {
      if (k in value) {
        const rows = findRows(value[k], depth + 1);
        if (rows) return rows;
      }
    }

    for (const x of Object.values(value)) {
      const rows = findRows(x, depth + 1);
      if (rows) return rows;
    }
  }

  return null;
}

function normalizePlu(v: any): string {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

function normalizeItem(source: any, qtyOverride?: any) {
  const pluRaw = pick(source, [
    "plu",
    "PLU",
    "kodePlu",
    "kode_plu",
    "plu_code",
    "kode",
    "kodebarang",
  ]);

  const qtyRaw =
    qtyOverride !== undefined
      ? qtyOverride
      : pick(source, ["qty", "QTY", "jumlah", "quantity", "qtySo", "qty_so"], "0");

  return {
    plu: Number(pluRaw),
    descp: String(
      pick(
        source,
        [
          "descp",
          "description",
          "desc",
          "nama_barang",
          "namaBarang",
          "nama",
          "product_name",
          "prd_deskripsipanjang",
        ],
        ""
      )
    ).trim(),
    conv1: Number(pick(source, ["conv1", "CONV1", "conv_1", "conversion1"], 0)),
    conv2: Number(pick(source, ["conv2", "CONV2", "conv_2", "conversion2"], 0)),
    subdept: Number(
      pick(
        source,
        [
          "subdept",
          "subDept",
          "sub_dept",
          "subDepartment",
          "SUBDEPT",
          "kode_subdept",
          "sub_department",
        ],
        0
      )
    ),
    barcode: String(
      pick(
        source,
        [
          "barcode",
          "BARCODE",
          "barCode",
          "ean",
          "ean13",
          "barcode1",
          "barcode_1",
          "kd_barcode",
          "kode_barcode",
        ],
        ""
      )
    ).trim(),
    tag: String(
      pick(
        source,
        [
          "tag",
          "TAG",
          "tag_item",
          "tagItem",
          "item_tag",
          "flag_tag",
          "flagTag",
        ],
        ""
      )
    ).trim(),
    qty: String(qtyRaw ?? "0"),
    avg_cost: Number(
      pick(
        source,
        [
          "avg_cost",
          "avgCost",
          "AVG_COST",
          "avgcost",
          "average_cost",
          "averageCost",
          "cost_avg",
          "costAvg",
        ],
        0
      )
    ),
  };
}

async function fetchCanonicalRows(
  kodeToko: string,
  dateSo: string,
  rakSo: string
): Promise<any[]> {
  const url = new URL(ENTRY_SOURCE_URL);
  url.searchParams.set("kodeToko", kodeToko);
  url.searchParams.set("dateSo", dateSo);
  url.searchParams.set("rakSo", rakSo);
  url.searchParams.set("_fresh", String(Date.now()));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache, no-store",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) return [];

  const raw = await response.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }

  return findRows(json) ?? [];
}

async function saveOne(
  kodeToko: string,
  dateSo: string,
  rakSo: string,
  item: any
) {
  const payload = {
    kodeToko,
    dateSo,
    rakSo,
    data: [item],
  };

  try {
    const response = await fetch(TARGET_URL, {
      method: "POST",
      headers: alfaHeaders(kodeToko),
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const raw = await response.text();
    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      body = { raw };
    }

    const message = String(
      body?.infoMsg ?? body?.message ?? body?.error ?? ""
    ).trim();

    const success =
      response.status === 201 ||
      (response.ok && /berhasil\s+simpan\s+entry\s+kkso/i.test(message));

    return {
      success,
      plu: item.plu,
      status: response.status,
      message: message || (success ? "Berhasil Simpan Entry KKSO" : "Save Entry KKSO gagal"),
      response: body,
      sent: payload,
    };
  } catch (error: any) {
    return {
      success: false,
      plu: item.plu,
      status: 0,
      message:
        error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "Timeout saat menghubungi server Alfastore"
          : error?.message || String(error),
      sent: payload,
    };
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    const body = await req.json();

    const kodeToko = String(body.kodeToko ?? body.storeId ?? "")
      .trim()
      .toUpperCase();
    const dateSo = String(body.dateSo ?? body.date ?? "").trim();
    const rakSo = String(body.rakSo ?? body.rak ?? "")
      .trim()
      .toUpperCase();
    const requested = Array.isArray(body.data)
      ? body.data
      : Array.isArray(body.items)
      ? body.items
      : [];

    if (!kodeToko || !dateSo || !rakSo || requested.length === 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: "kodeToko, dateSo, rakSo, dan data wajib diisi.",
      });
    }

    // Ambil ulang data rak agar barcode/tag/avg_cost/conv/subdept mengikuti data
    // sumber asli, bukan nilai default dari browser.
    let canonicalRows: any[] = [];
    try {
      canonicalRows = await fetchCanonicalRows(kodeToko, dateSo, rakSo);
    } catch {
      canonicalRows = [];
    }

    const canonicalMap = new Map<string, any>();
    for (const row of canonicalRows) {
      const plu = normalizePlu(
        pick(row, ["plu", "PLU", "kodePlu", "kode_plu", "kodebarang"], "")
      );
      if (plu) canonicalMap.set(plu, row);
    }

    const items = requested.map((incoming: any) => {
      const pluKey = normalizePlu(
        pick(incoming, ["plu", "PLU", "kodePlu", "kode_plu"], "")
      );
      const canonical = canonicalMap.get(pluKey);

      // Metadata canonical menang; QTY selalu mengikuti nilai yang dikirim user.
      const merged = canonical
        ? { ...incoming, ...canonical }
        : incoming;
      const qty = pick(incoming, ["qty", "QTY", "jumlah", "quantity"], "0");

      return normalizeItem(merged, qty);
    });

    const invalid = items
      .map((item, index) => {
        const missing: string[] = [];
        if (!Number.isFinite(item.plu) || item.plu <= 0) missing.push("plu");
        if (!item.descp) missing.push("descp");
        if (!item.barcode) missing.push("barcode");
        if (!item.tag) missing.push("tag");
        if (!/^\d+$/.test(item.qty)) missing.push("qty");
        if (!Number.isFinite(item.avg_cost)) missing.push("avg_cost");
        return missing.length ? { index, plu: item.plu, missing, item } : null;
      })
      .filter(Boolean);

    if (invalid.length > 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: `${invalid.length} item belum memiliki metadata lengkap dari data rak.`,
        diagnostic:
          "Pastikan endpoint entry-kkso mengembalikan barcode, tag, avg_cost, descp, conv1, conv2, dan subdept.",
        kodeToko,
        dateSo,
        rakSo,
        canonicalRows: canonicalRows.length,
        invalid: invalid.slice(0, 10),
      });
    }

    // Endpoint asli yang dicapture mengirim data:[1 item]. Proses paralel per batch
    // supaya tidak timeout pada rak besar, tetapi tidak mengubah struktur request asli.
    const results: any[] = [];
    const CONCURRENCY = 6;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((item) => saveOne(kodeToko, dateSo, rakSo, item))
      );
      results.push(...batchResults);
    }

    const berhasil = results.filter((x) => x.success);
    const gagal = results.filter((x) => !x.success);

    if (gagal.length > 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: `${berhasil.length} item berhasil, ${gagal.length} item gagal disimpan.`,
        diagnostic: gagal[0]?.message || "Server Alfastore menolak item.",
        kodeToko,
        dateSo,
        rakSo,
        totalItem: items.length,
        totalBerhasil: berhasil.length,
        totalGagal: gagal.length,
        firstError: gagal[0],
        gagal: gagal.slice(0, 10),
        elapsedMs: Date.now() - started,
      });
    }

    return NextResponse.json({
      success: true,
      saved: true,
      version: VERSION,
      message: "Berhasil Simpan Entry KKSO",
      kodeToko,
      dateSo,
      rakSo,
      totalItem: items.length,
      totalBerhasil: berhasil.length,
      totalGagal: 0,
      elapsedMs: Date.now() - started,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      version: VERSION,
      message: "Internal error Save Entry KKSO",
      diagnostic: error?.message || String(error),
      elapsedMs: Date.now() - started,
    });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  return NextResponse.json({
    success: true,
    version: VERSION,
    api: "save-entry",
    method: "POST",
    storeId: searchParams.get("storeId") ?? "",
    date: searchParams.get("date") ?? searchParams.get("dateSo") ?? "",
    message: "Route save-entry aktif dan metadata item diambil ulang dari entry-kkso.",
  });
}
