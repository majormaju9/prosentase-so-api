import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERSION = "simpan-hydrate-v8";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

const ENTRY_SOURCE_URL =
  "https://lautanapi.vercel.app/api/entry-kkso";

function upstreamHeaders(storeId: string): Record<string, string> {
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
    Androidid: "712f8db18eeb1816",
    "Branch-Id": "MZ01",
    "Class-Store": "",
    "Company-Id": "",
    "Company-Ext": "",
    Platform: "ANDROID",
    "Mac-Addr": "712f8db18eeb1816",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function normKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(obj: any, names: string[], fallback: any = undefined): any {
  if (!obj || typeof obj !== "object") return fallback;

  for (const name of names) {
    if (obj[name] !== undefined && obj[name] !== null) return obj[name];
  }

  const wanted = new Set(names.map(normKey));
  for (const [key, value] of Object.entries(obj)) {
    if (
      wanted.has(normKey(key)) &&
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
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
      objectRows.some(
        (x) =>
          pick(
            x,
            ["plu", "PLU", "kodePlu", "kode_plu", "kodebarang"],
            null
          ) !== null
      )
    ) {
      return objectRows;
    }

    for (const item of value) {
      const found = findRows(item, depth + 1);
      if (found) return found;
    }

    return null;
  }

  if (typeof value === "object") {
    for (const key of [
      "data",
      "result",
      "results",
      "items",
      "rows",
      "response",
    ]) {
      if (key in value) {
        const found = findRows(value[key], depth + 1);
        if (found) return found;
      }
    }

    for (const item of Object.values(value)) {
      const found = findRows(item, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function normalizePlu(value: any): string {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return raw;
  return String(Number(raw));
}

async function getRackRows(
  kodeToko: string,
  dateSo: string,
  rakSo: string
): Promise<any[]> {
  const url = new URL(ENTRY_SOURCE_URL);
  url.searchParams.set("kodeToko", kodeToko);
  url.searchParams.set("dateSo", dateSo);
  url.searchParams.set("rakSo", rakSo);

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

  try {
    const json = JSON.parse(raw);
    return findRows(json) ?? [];
  } catch {
    return [];
  }
}

function makeSaveItem(source: any, qty: any) {
  const plu = Number(
    pick(source, [
      "plu",
      "PLU",
      "kodePlu",
      "kode_plu",
      "plu_code",
      "kodebarang",
    ])
  );

  const descp = String(
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
  ).trim();

  const barcode = String(
    pick(
      source,
      [
        "barcode",
        "BARCODE",
        "barCode",
        "bar_code",
        "ean",
        "ean13",
        "barcode1",
        "barcode_1",
        "kd_barcode",
        "kode_barcode",
      ],
      ""
    )
  ).trim();

  const tag = String(
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
  ).trim();

  const avgCostRaw = pick(source, [
    "avg_cost",
    "avgCost",
    "AVG_COST",
    "avgcost",
    "average_cost",
    "averageCost",
    "cost_avg",
    "costAvg",
  ]);

  return {
    plu,
    descp,
    conv1: Number(
      pick(source, ["conv1", "CONV1", "conv_1", "conversion1"], 0)
    ),
    conv2: Number(
      pick(source, ["conv2", "CONV2", "conv_2", "conversion2"], 0)
    ),
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
    barcode,
    tag,
    qty: String(qty ?? "0"),
    avg_cost:
      avgCostRaw === undefined || avgCostRaw === null || avgCostRaw === ""
        ? Number.NaN
        : Number(avgCostRaw),
  };
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
      headers: upstreamHeaders(kodeToko),
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const raw = await response.text();

    let upstream: any;
    try {
      upstream = JSON.parse(raw);
    } catch {
      upstream = { raw };
    }

    const message = String(
      upstream?.infoMsg ?? upstream?.message ?? upstream?.error ?? ""
    ).trim();

    const success =
      response.status === 201 ||
      (response.ok && /berhasil\s+simpan\s+entry\s+kkso/i.test(message));

    return {
      success,
      plu: item.plu,
      upstreamStatus: response.status,
      message:
        message ||
        (success ? "Berhasil Simpan Entry KKSO" : `Upstream HTTP ${response.status}`),
      upstream,
    };
  } catch (error: any) {
    return {
      success: false,
      plu: item.plu,
      upstreamStatus: 0,
      message:
        error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "Timeout saat menghubungi server Alfastore"
          : error?.message || String(error),
    };
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    const body = await req.json();

    const url = new URL(req.url);

    const kodeToko = String(
      body.kodeToko ??
        body.storeId ??
        url.searchParams.get("storeId") ??
        url.searchParams.get("kodeToko") ??
        ""
    )
      .trim()
      .toUpperCase();

    const dateSo = String(
      body.dateSo ??
        body.date ??
        url.searchParams.get("dateSo") ??
        url.searchParams.get("date") ??
        ""
    ).trim();

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
        message: "kodeToko/storeId, dateSo, rakSo, dan data wajib diisi.",
      });
    }

    // Ambil metadata asli sesuai toko + tanggal + rak yang sedang dibuka.
    const canonicalRows = await getRackRows(kodeToko, dateSo, rakSo);

    const canonicalMap = new Map<string, any>();

    for (const row of canonicalRows) {
      const key = normalizePlu(
        pick(row, ["plu", "PLU", "kodePlu", "kode_plu", "kodebarang"], "")
      );
      if (key) canonicalMap.set(key, row);
    }

    const items = requested.map((incoming: any) => {
      const key = normalizePlu(
        pick(incoming, ["plu", "PLU", "kodePlu", "kode_plu"], "")
      );

      const canonical = canonicalMap.get(key);

      // Data canonical diprioritaskan agar field internal tidak menjadi null.
      // QTY tetap mengikuti nilai terbaru dari halaman Entry.
      const merged = canonical ? { ...incoming, ...canonical } : incoming;
      const qty = pick(incoming, ["qty", "QTY", "jumlah", "quantity"], "0");

      return makeSaveItem(merged, qty);
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
        if (!Number.isFinite(item.conv1)) missing.push("conv1");
        if (!Number.isFinite(item.conv2)) missing.push("conv2");
        if (!Number.isFinite(item.subdept)) missing.push("subdept");

        return missing.length
          ? {
              index,
              plu: item.plu,
              missing,
            }
          : null;
      })
      .filter(Boolean);

    // Jangan meneruskan data rusak/null ke save_entry_kkso karena menghasilkan 406.
    if (invalid.length > 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: `${invalid.length} item belum memiliki metadata lengkap dari entry-kkso.`,
        kodeToko,
        dateSo,
        rakSo,
        canonicalRows: canonicalRows.length,
        invalid: invalid.slice(0, 20),
      });
    }

    // Request aplikasi asli memakai data:[1 item]. Jalankan beberapa secara paralel
    // supaya rak besar tetap selesai tanpa timeout PHP.
    const results: any[] = [];
    const CONCURRENCY = 6;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY);
      const batchResult = await Promise.all(
        batch.map((item) => saveOne(kodeToko, dateSo, rakSo, item))
      );
      results.push(...batchResult);
    }

    const berhasil = results.filter((x) => x.success);
    const gagal = results.filter((x) => !x.success);

    if (gagal.length > 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: `${berhasil.length} item berhasil, ${gagal.length} item gagal disimpan.`,
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
      message: "Internal error Simpan Entry KKSO",
      error: error?.message || String(error),
      elapsedMs: Date.now() - started,
    });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  return NextResponse.json({
    success: true,
    version: VERSION,
    api: "simpan",
    method: "POST",
    storeId:
      searchParams.get("storeId") ?? searchParams.get("kodeToko") ?? "",
    date:
      searchParams.get("dateSo") ?? searchParams.get("date") ?? "",
    message:
      "Route /api/simpan aktif. Metadata save diambil ulang dari entry-kkso.",
  });
}
