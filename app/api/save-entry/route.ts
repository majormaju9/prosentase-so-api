import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VERSION = "save-entry-parallel-v5";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

function getHeaders(storeId: string) {
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

    "Api-Key":
      "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

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

function normalizeItem(item: any) {
  return {
    plu: Number(item.plu),

    descp: String(
      item.descp ??
      item.description ??
      item.nama ??
      item.namaBarang ??
      ""
    ).trim(),

    conv1: Number(item.conv1 ?? 0),
    conv2: Number(item.conv2 ?? 0),

    subdept: Number(
      item.subdept ??
      item.subDept ??
      0
    ),

    barcode: String(
      item.barcode ??
      item.barCode ??
      ""
    ).trim(),

    tag: String(
      item.tag ??
      item.flag ??
      ""
    ).trim(),

    qty: String(
      item.qty ??
      item.jumlah ??
      item.quantity ??
      "0"
    ),

    avg_cost: Number(
      item.avg_cost ??
      item.avgCost ??
      item.cost ??
      0
    ),
  };
}

async function saveOneItem(
  kodeToko: string,
  dateSo: string,
  rakSo: string,
  item: any
) {
  const payload = {
    kodeToko,
    dateSo,
    rakSo,

    // PENTING:
    // aplikasi asli mengirim satu item
    data: [item],
  };

  try {
    const res = await fetch(TARGET_URL, {
      method: "POST",

      headers: getHeaders(kodeToko),

      body: JSON.stringify(payload),

      cache: "no-store",

      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();

    let response: any;

    try {
      response = JSON.parse(raw);
    } catch {
      response = { raw };
    }

    const msg = String(
      response?.infoMsg ??
      response?.message ??
      ""
    );

    const success =
      res.status === 201 ||
      (
        res.ok &&
        /berhasil simpan entry kkso/i.test(msg)
      );

    return {
      success,

      plu: item.plu,

      status: res.status,

      message:
        msg ||
        (success
          ? "Berhasil Simpan Entry KKSO"
          : "Save Entry KKSO gagal"),

      response,

      // berguna untuk debug data yang ditolak
      sent: payload,
    };
  } catch (error: any) {
    return {
      success: false,

      plu: item.plu,

      status: 0,

      message:
        error?.name === "TimeoutError"
          ? "Timeout ke server Alfastore"
          : error?.message || String(error),

      sent: payload,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const kodeToko = String(
      body.kodeToko ??
      body.storeId ??
      ""
    )
      .trim()
      .toUpperCase();

    const dateSo = String(
      body.dateSo ??
      body.date ??
      ""
    ).trim();

    const rakSo = String(
      body.rakSo ??
      body.rak ??
      ""
    )
      .trim()
      .toUpperCase();

    const sourceData =
      Array.isArray(body.data)
        ? body.data
        : [];

    if (!kodeToko) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: "kodeToko/storeId kosong",
      });
    }

    if (!dateSo) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: "dateSo/date kosong",
      });
    }

    if (!rakSo) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: "rakSo kosong",
      });
    }

    if (sourceData.length === 0) {
      return NextResponse.json({
        success: false,
        version: VERSION,
        message: "Data item kosong",
      });
    }

    const items =
      sourceData.map(normalizeItem);

    // ================================
    // VALIDASI DATA SEBELUM DIKIRIM
    // ================================

    const invalid = items
      .map((item, index) => {
        const missing: string[] = [];

        if (
          !Number.isFinite(item.plu) ||
          item.plu <= 0
        ) {
          missing.push("plu");
        }

        if (!item.descp) {
          missing.push("descp");
        }

        if (!item.barcode) {
          missing.push("barcode");
        }

        if (!item.tag) {
          missing.push("tag");
        }

        if (
          !Number.isFinite(item.avg_cost)
        ) {
          missing.push("avg_cost");
        }

        return missing.length
          ? {
              index,
              plu: item.plu,
              missing,
              item,
            }
          : null;
      })
      .filter(Boolean);

    if (invalid.length) {
      return NextResponse.json({
        success: false,

        version: VERSION,

        message:
          `${invalid.length} item memiliki data tidak lengkap.`,

        kodeToko,
        dateSo,
        rakSo,

        totalItem: items.length,

        invalid:
          invalid.slice(0, 10),
      });
    }

    // ==========================================
    // PROSES PARALEL, 8 ITEM PER BATCH
    // ==========================================

    const results: any[] = [];

    const CONCURRENCY = 8;

    for (
      let i = 0;
      i < items.length;
      i += CONCURRENCY
    ) {
      const batch =
        items.slice(
          i,
          i + CONCURRENCY
        );

      const batchResults =
        await Promise.all(
          batch.map((item) =>
            saveOneItem(
              kodeToko,
              dateSo,
              rakSo,
              item
            )
          )
        );

      results.push(
        ...batchResults
      );
    }

    const berhasil =
      results.filter(
        (x) => x.success
      );

    const gagal =
      results.filter(
        (x) => !x.success
      );

    if (gagal.length > 0) {
      return NextResponse.json({
        success: false,

        version: VERSION,

        message:
          `${berhasil.length} item berhasil, ${gagal.length} item gagal disimpan.`,

        kodeToko,
        dateSo,
        rakSo,

        totalItem:
          items.length,

        totalBerhasil:
          berhasil.length,

        totalGagal:
          gagal.length,

        // Ini yang penting untuk mencari
        // penyebab asli kegagalan.
        firstError:
          gagal[0],

        gagal:
          gagal.slice(0, 10),
      });
    }

    return NextResponse.json({
      success: true,

      version: VERSION,

      message:
        "Berhasil Simpan Entry KKSO",

      kodeToko,
      dateSo,
      rakSo,

      totalItem:
        items.length,

      totalBerhasil:
        berhasil.length,

      totalGagal: 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,

      version: VERSION,

      message:
        "Internal error Save Entry KKSO",

      error:
        error?.message ||
        String(error),
    });
  }
}

export async function GET(
  req: NextRequest
) {
  const { searchParams } =
    new URL(req.url);

  return NextResponse.json({
    success: true,

    version: VERSION,

    api: "save-entry",

    method: "POST",

    storeId:
      searchParams.get("storeId") ??
      "",

    date:
      searchParams.get("date") ??
      "",

    message:
      "Route parallel per-item aktif.",
  });
}
