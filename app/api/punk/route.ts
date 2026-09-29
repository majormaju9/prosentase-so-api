import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // =========================
    // VALIDASI
    // =========================

    if (!body.kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!body.dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "dateSo wajib diisi",
        },
        { status: 400 }
      );
    }

    if (!body.rakSo) {
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
          message: "Data barang kosong",
        },
        { status: 400 }
      );
    }

    // =========================
    // BODY API ALFASTORE
    // =========================

    const payload = {
      kodeToko: String(body.kodeToko).trim().toUpperCase(),
      dateSo: String(body.dateSo),
      rakSo: String(body.rakSo).trim().toUpperCase(),

      data: body.data.map((item: any) => ({
        plu: Number(item.plu),
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

    // =========================
    // REQUEST KE ALFASTORE
    // =========================

    const response = await fetch(TARGET_URL, {
      method: "POST",

      headers: {
        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

        "Version-App": "V.2026.04.13.01-alfa",

        "Version-Code": "28",

        "App-Uid": "",

        "User-Id": "23067884",

        // mengikuti kode toko yang dikirim
        "Store-Id": String(body.kodeToko)
          .trim()
          .toUpperCase(),

        "Store-Id-Ext": "",

        "Shard-Id": "",

        "Ip-Addr": "10.1.10.1",

        Sn: "",

        "Api-Key":
          "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

        Androidid: "712f8db18eeb1816",

        "Branch-Id": "MZ01",

        "Class-Store": "",

        "Company-Id": "",

        "Company-Ext": "",

        Platform: "ANDROID",

        "Mac-Addr": "712f8db18eeb1816",

        "Content-Type":
          "application/json; charset=utf-8",

        Accept: "application/json",
      },

      body: JSON.stringify(payload),

      cache: "no-store",
    });

    // =========================
    // BACA RESPONSE
    // =========================

    const responseText = await response.text();

    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = {
        raw: responseText,
      };
    }

    // =========================
    // JIKA API ERROR
    // =========================

    if (!response.ok) {
      console.error(
        "ALFASTORE ERROR:",
        response.status,
        responseData
      );

      return NextResponse.json(
        {
          success: false,
          status: response.status,
          message: "Gagal simpan Entry KKSO",
          response: responseData,
        },
        {
          status: response.status,
        }
      );
    }

    // =========================
    // BERHASIL
    // 201 CREATED JUGA SUKSES
    // =========================

    return NextResponse.json(
      {
        success: true,
        status: response.status,
        ...responseData,
      },
      {
        status: response.status,
      }
    );
  } catch (error: any) {
    console.error(
      "SAVE PER ITEM ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan saat save per item",
        error:
          error?.message ||
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}
