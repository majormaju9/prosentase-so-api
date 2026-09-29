import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ==============================
    // VALIDASI
    // ==============================
    const kodeToko = String(
      body.kodeToko || body.storeId || ""
    )
      .trim()
      .toUpperCase();

    const dateSo = String(
      body.dateSo || body.date || ""
    ).trim();

    const rakSo = String(
      body.rakSo || ""
    )
      .trim()
      .toUpperCase();

    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "dateSo wajib diisi",
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

    if (!Array.isArray(body.data) || body.data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "data item wajib diisi",
        },
        { status: 400 }
      );
    }

    // ==============================
    // PAYLOAD
    // ==============================
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
        tag: String(item.tag ?? "P"),
        qty: String(item.qty ?? "0"),
        avg_cost: Number(item.avg_cost ?? 0),
      })),
    };

    console.log("SAVE ENTRY KKSO REQUEST:");
    console.log(JSON.stringify(payload));

    // ==============================
    // REQUEST KE ALFASTORE
    // ==============================
    const response = await fetch(TARGET_URL, {
      method: "POST",

      headers: {
        Accept: "application/json",

        "App-Name": "SO-PDA",

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

        Sn:
          "",

        "Api-Key":
          "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        AndroidId:
          "712f8db18eeb1816",

        "Branch-Id":
          "MZ01",

        "Class-Store":
          "",

        "Company-Id":
          "",

        "Company-Ext":
          "",

        Platform:
          "ANDROID",

        "Mac-Addr":
          "712f8db18eeb1816",

        "Content-Type":
          "application/json; charset=utf-8",
      },

      body: JSON.stringify(payload),

      cache: "no-store",
    });

    // ==============================
    // RESPONSE
    // ==============================
    const raw = await response.text();

    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      data = {
        raw,
      };
    }

    console.log(
      "SAVE ENTRY KKSO RESPONSE:",
      response.status,
      data
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          upstreamStatus: response.status,
          message: "Save Entry KKSO gagal",
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
        upstreamStatus: response.status,
        ...data,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "SAVE ENTRY KKSO ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi error saat save Entry KKSO",
        error:
          error?.message ||
          String(error),
      },
      {
        status: 200,
      }
    );
  }
}

// =================================
// GET UNTUK CEK ROUTE
// =================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const storeId =
    searchParams.get("storeId") || "";

  const date =
    searchParams.get("date") || "";

  return NextResponse.json({
    success: true,
    api: "save-entry-kkso",
    endpoint:
      "/api/save-entry-kkso",
    method: "POST",
    storeId,
    date,
    target:
      "save_entry_kkso",
    message:
      "API aktif. Gunakan POST untuk Save Entry KKSO.",
  });
}
