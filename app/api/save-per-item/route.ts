import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";

// ==========================================
// GET
// Agar URL tidak error saat dibuka di browser
// ==========================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const storeId =
    searchParams.get("storeId") ||
    searchParams.get("kodeToko") ||
    "";

  const date =
    searchParams.get("date") ||
    searchParams.get("dateSo") ||
    "";

  return NextResponse.json(
    {
      success: true,
      api: "save-per-item",
      message: "API aktif. Gunakan POST untuk menyimpan item.",
      storeId,
      date,
      method: "POST",
      endpoint: "/api/save-per-item",
      exampleBody: {
        kodeToko: storeId || "M604",
        dateSo: date || "29-09-2026",
        rakSo: "HB3",
        data: [
          {
            plu: 460947,
            descp: "DELFI DAIRY MILK BOGOF 2X25G",
            conv1: 0,
            conv2: 0,
            subdept: 0,
            barcode: "899100166346",
            tag: "N",
            qty: "1",
            avg_cost: 6354.81,
          },
        ],
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

// ==========================================
// POST SAVE PER ITEM
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const kodeToko = String(
      body.kodeToko ||
      body.storeId ||
      ""
    )
      .trim()
      .toUpperCase();

    const dateSo = String(
      body.dateSo ||
      body.date ||
      ""
    ).trim();

    const rakSo = String(
      body.rakSo ||
      body.rak ||
      ""
    )
      .trim()
      .toUpperCase();

    // ======================================
    // VALIDASI
    // ======================================

    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko/storeId wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "dateSo/date wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!rakSo) {
      return NextResponse.json(
        {
          success: false,
          message: "rakSo wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.data)) {
      return NextResponse.json(
        {
          success: false,
          message: "data harus berupa array",
        },
        { status: 400 }
      );
    }

    if (body.data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Data barang kosong",
        },
        { status: 400 }
      );
    }

    // ======================================
    // PAYLOAD
    // ======================================

    const payload = {
      kodeToko,
      dateSo,
      rakSo,

      data: body.data.map((item: any) => ({
        plu: Number(item.plu ?? 0),
        descp: String(item.descp ?? ""),
        conv1: Number(item.conv1 ?? 0),
        conv2: Number(item.conv2 ?? 0),
        subdept: Number(item.subdept ?? 0),
        barcode: String(item.barcode ?? ""),
        tag: String(item.tag ?? "N"),
        qty: String(item.qty ?? "0"),
        avg_cost: Number(item.avg_cost ?? 0),
      })),
    };

    console.log("SAVE PER ITEM PAYLOAD:", payload);

    // ======================================
    // REQUEST ALFASTORE
    // ======================================

    const upstream = await fetch(TARGET_URL, {
      method: "POST",

      headers: {
        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "Version-App":
          "V.2026.04.13.01-alfa",

        "Version-Code":
          "28",

        "App-Uid":
          "",

        "User-Id":
          "23067884",

        "Store-Id":
          kodeToko,

        "Store-Id-Ext":
          "",

        "Shard-Id":
          "",

        "Ip-Addr":
          "10.1.10.1",

        "Sn":
          "",

        "Api-Key":
          "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        "Androidid":
          "712f8db18eeb1816",

        "Branch-Id":
          "MZ01",

        "Class-Store":
          "",

        "Company-Id":
          "",

        "Company-Ext":
          "",

        "Platform":
          "ANDROID",

        "Mac-Addr":
          "712f8db18eeb1816",

        "Content-Type":
          "application/json; charset=utf-8",

        "Accept":
          "application/json",
      },

      body: JSON.stringify(payload),

      cache: "no-store",
    });

    // ======================================
    // RESPONSE UPSTREAM
    // ======================================

    const raw = await upstream.text();

    let data: any = null;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        raw,
      };
    }

    console.log(
      "SAVE PER ITEM RESPONSE:",
      upstream.status,
      data
    );

    // Jangan teruskan status error mentah ke browser.
    // Supaya frontend tetap bisa membaca JSON.
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,
          upstreamStatus: upstream.status,
          message: "Alfastore menolak request save per item",
          response: data,
        },
        {
          status: 200,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        upstreamStatus: upstream.status,
        response: data,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("SAVE PER ITEM ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal melakukan save per item",
        error:
          error?.message ||
          String(error),
      },
      {
        // Dibuat 200 agar browser/frontend
        // tetap mendapatkan JSON error
        status: 200,
      }
    );
  }
}
