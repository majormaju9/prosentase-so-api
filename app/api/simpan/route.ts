import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

export async function POST(req: NextRequest) {
  try {
    // ==============================
    // QUERY PARAMETER
    // ==============================
    const url = new URL(req.url);

    const queryStoreId =
      url.searchParams.get("storeId")?.trim().toUpperCase() || "";

    const queryDateSo =
      url.searchParams.get("dateSo")?.trim() || "";

    // ==============================
    // BODY
    // ==============================
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body harus berupa JSON",
        },
        { status: 400 }
      );
    }

    // ==============================
    // NORMALISASI DATA
    // ==============================
    const kodeToko = String(
      body.kodeToko ||
        body.storeId ||
        queryStoreId ||
        ""
    )
      .trim()
      .toUpperCase();

    const dateSo = String(
      body.dateSo ||
        body.date ||
        queryDateSo ||
        ""
    ).trim();

    const rakSo = String(
      body.rakSo || ""
    )
      .trim()
      .toUpperCase();

    const data = Array.isArray(body.data)
      ? body.data
      : [];

    // ==============================
    // VALIDASI
    // ==============================
    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko / storeId wajib diisi",
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

    if (data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "data item kosong",
        },
        { status: 400 }
      );
    }

    // ==============================
    // PAYLOAD SESUAI APP
    // ==============================
    const payload = {
      kodeToko,
      dateSo,
      rakSo,

      data: data.map((item: any) => ({
        plu: Number(item.plu) || 0,

        descp: String(
          item.descp ?? ""
        ),

        conv1: Number(
          item.conv1 ?? 0
        ),

        conv2: Number(
          item.conv2 ?? 0
        ),

        subdept: Number(
          item.subdept ?? 0
        ),

        barcode: String(
          item.barcode ?? ""
        ),

        tag: String(
          item.tag ?? ""
        ),

        // API asli mengirim qty sebagai STRING
        qty: String(
          item.qty ?? "0"
        ),

        avg_cost: Number(
          item.avg_cost ?? 0
        ),
      })),
    };

    // ==============================
    // REQUEST KE SERVER ALFASTORE
    // ==============================
    const response = await fetch(
      TARGET_URL,
      {
        method: "POST",

        headers: {
          Accept: "application/json",

          "Content-Type":
            "application/json; charset=utf-8",

          "App-Name": "SO-PDA",

          "Version-App":
            "V.2026.04.13.01-alfa",

          "Version-Code": "28",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; U; Android 15)",

          "User-Id":
            process.env.ALFA_USER_ID ||
            "23067884",

          "Store-Id":
            kodeToko,

          "Ip-Addr":
            process.env.ALFA_IP_ADDR ||
            "10.1.10.1",

          "Api-Key":
            process.env.ALFA_API_KEY ||
            "",

          "AndroidId":
            process.env.ALFA_ANDROID_ID ||
            "712f8db18eeb1816",

          "Branch-Id":
            process.env.ALFA_BRANCH_ID ||
            "MZ01",

          Platform: "ANDROID",
        },

        body: JSON.stringify(payload),

        cache: "no-store",
      }
    );

    // ==============================
    // RESPONSE ASLI
    // ==============================
    const responseText =
      await response.text();

    let responseData: any;

    try {
      responseData =
        JSON.parse(responseText);
    } catch {
      responseData = {
        raw: responseText,
      };
    }

    // ==============================
    // CEK BERHASIL
    // ==============================
    const infoMsg =
      responseData?.infoMsg ||
      responseData?.message ||
      "";

    const berhasil =
      response.ok &&
      /berhasil/i.test(
        String(infoMsg)
      );

    return NextResponse.json(
      {
        success:
          berhasil || response.ok,

        status:
          response.status,

        storeId:
          kodeToko,

        dateSo,

        rakSo,

        jumlahItem:
          payload.data.length,

        request: payload,

        response:
          responseData,
      },
      {
        status:
          response.status,
      }
    );
  } catch (error: any) {
    console.error(
      "SAVE ENTRY ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Gagal menghubungi server save entry",

        error:
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}

// ==============================
// CEK ROUTE VIA GET
// ==============================
export async function GET(
  req: NextRequest
) {
  const url =
    new URL(req.url);

  return NextResponse.json({
    success: true,
    api: "simpan",
    method: "POST",

    storeId:
      url.searchParams.get(
        "storeId"
      ) || "",

    dateSo:
      url.searchParams.get(
        "dateSo"
      ) || "",

    message:
      "Route aktif. Gunakan POST untuk simpan entry.",
  });
}
