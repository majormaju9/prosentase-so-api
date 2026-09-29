import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

function makeHeaders(storeId: string) {
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

async function saveItem(
  kodeToko: string,
  dateSo: string,
  rakSo: string,
  originalItem: any
) {
  // Jangan bikin ulang metadata barang dengan nilai default.
  // Pertahankan nilai asli yang dikirim frontend.
  const item = {
    plu: Number(originalItem.plu),

    descp: String(
      originalItem.descp ??
      originalItem.description ??
      ""
    ),

    conv1: Number(originalItem.conv1),

    conv2: Number(originalItem.conv2),

    subdept: Number(originalItem.subdept),

    barcode: String(originalItem.barcode ?? ""),

    tag: String(originalItem.tag ?? ""),

    qty: String(
      originalItem.qty ??
      originalItem.jumlah ??
      "0"
    ),

    avg_cost: Number(
      originalItem.avg_cost ??
      originalItem.avgCost
    ),
  };

  const payload = {
    kodeToko,
    dateSo,
    rakSo,
    data: [item],
  };

  try {
    const res = await fetch(TARGET_URL, {
      method: "POST",
      headers: makeHeaders(kodeToko),
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.text();

    let upstream: any;

    try {
      upstream = JSON.parse(raw);
    } catch {
      upstream = {
        raw,
      };
    }

    const infoMsg = String(
      upstream?.infoMsg ??
      upstream?.message ??
      ""
    );

    const success =
      res.status === 201 ||
      (
        res.ok &&
        /berhasil simpan entry kkso/i.test(infoMsg)
      );

    return {
      success,

      plu: item.plu,

      upstreamStatus: res.status,

      message:
        infoMsg ||
        `Upstream HTTP ${res.status}`,

      upstream,

      // sementara untuk debugging
      sent: payload,
    };
  } catch (error: any) {
    return {
      success: false,

      plu: item.plu,

      upstreamStatus: 0,

      message:
        error?.message ??
        String(error),
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

    const data =
      Array.isArray(body.data)
        ? body.data
        : [];

    if (!kodeToko) {
      return NextResponse.json({
        success: false,
        message: "kodeToko kosong",
      });
    }

    if (!dateSo) {
      return NextResponse.json({
        success: false,
        message: "dateSo kosong",
      });
    }

    if (!rakSo) {
      return NextResponse.json({
        success: false,
        message: "rakSo kosong",
      });
    }

    if (!data.length) {
      return NextResponse.json({
        success: false,
        message: "Data item kosong",
      });
    }

    /*
     * PENTING:
     * Endpoint asli yang Anda capture memakai:
     *
     * data: [ SATU ITEM ]
     *
     * Jadi kita kirim satu item per request.
     * Tapi proses beberapa item paralel agar tidak timeout.
     */

    const results = await Promise.all(
      data.map((item: any) =>
        saveItem(
          kodeToko,
          dateSo,
          rakSo,
          item
        )
      )
    );

    const berhasil =
      results.filter(
        (x) => x.success
      );

    const gagal =
      results.filter(
        (x) => !x.success
      );

    if (gagal.length) {
      return NextResponse.json({
        success: false,

        message:
          `${berhasil.length} item berhasil, ` +
          `${gagal.length} item gagal disimpan.`,

        kodeToko,
        dateSo,
        rakSo,

        total:
          data.length,

        totalBerhasil:
          berhasil.length,

        totalGagal:
          gagal.length,

        // lihat ini jika masih 406
        firstError:
          gagal[0],

        gagal,
      });
    }

    return NextResponse.json({
      success: true,

      message:
        "Berhasil Simpan Entry KKSO",

      kodeToko,
      dateSo,
      rakSo,

      total:
        data.length,

      totalBerhasil:
        berhasil.length,

      totalGagal: 0,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,

      message:
        "Internal error Save Entry",

      error:
        error?.message ??
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

    version:
      "save-entry-debug-406-v7",

    method:
      "POST",

    storeId:
      searchParams.get("storeId") ??
      "",

    date:
      searchParams.get("date") ??
      "",

    message:
      "Route save-entry aktif.",
  });
}
