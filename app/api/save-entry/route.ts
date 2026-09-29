import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

// =====================================================
// HEADER ALFASTORE
// =====================================================
function alfaHeaders(storeId: string) {
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

// =====================================================
// POST SAVE ENTRY KKSO
// =====================================================
export async function POST(req: NextRequest) {
  try {
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request bukan JSON yang valid",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // AMBIL PARAMETER
    // =================================================
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

    const rawData =
      Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.items)
        ? body.items
        : [];

    // =================================================
    // VALIDASI HEADER DATA
    // =================================================
    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko/storeId kosong",
        },
        {
          status: 400,
        }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "dateSo/date kosong",
        },
        {
          status: 400,
        }
      );
    }

    if (!rakSo) {
      return NextResponse.json(
        {
          success: false,
          message: "rakSo kosong",
        },
        {
          status: 400,
        }
      );
    }

    if (rawData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Data barang kosong",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // NORMALISASI DATA ITEM
    // Jangan membuat data palsu untuk field penting.
    // =================================================
    const data = rawData.map(
      (item: any, index: number) => {
        const plu = Number(item.plu);

        const descp = String(
          item.descp ??
            item.description ??
            item.nama ??
            ""
        ).trim();

        const barcode = String(
          item.barcode ??
            item.barCode ??
            ""
        ).trim();

        const tag = String(
          item.tag ?? ""
        ).trim();

        const qtyRaw =
          item.qty ??
          item.quantity ??
          item.oh;

        const avgCostRaw =
          item.avg_cost ??
          item.avgCost ??
          item.cost;

        return {
          index,
          plu,

          descp,

          conv1: Number(
            item.conv1 ?? 0
          ),

          conv2: Number(
            item.conv2 ?? 0
          ),

          subdept: Number(
            item.subdept ?? 0
          ),

          barcode,

          tag,

          qty:
            qtyRaw === undefined ||
            qtyRaw === null
              ? ""
              : String(qtyRaw),

          avg_cost:
            avgCostRaw === undefined ||
            avgCostRaw === null ||
            avgCostRaw === ""
              ? NaN
              : Number(avgCostRaw),
        };
      }
    );

    // =================================================
    // VALIDASI SETIAP ITEM
    // =================================================
    for (const item of data) {
      if (
        !Number.isFinite(item.plu) ||
        item.plu <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `PLU item ke-${item.index + 1} tidak valid`,
            item,
          },
          {
            status: 422,
          }
        );
      }

      if (!item.descp) {
        return NextResponse.json(
          {
            success: false,
            message:
              `descp item PLU ${item.plu} kosong`,
          },
          {
            status: 422,
          }
        );
      }

      if (!item.barcode) {
        return NextResponse.json(
          {
            success: false,
            message:
              `barcode item PLU ${item.plu} kosong`,
          },
          {
            status: 422,
          }
        );
      }

      if (!item.tag) {
        return NextResponse.json(
          {
            success: false,
            message:
              `tag item PLU ${item.plu} kosong`,
          },
          {
            status: 422,
          }
        );
      }

      if (item.qty === "") {
        return NextResponse.json(
          {
            success: false,
            message:
              `qty item PLU ${item.plu} kosong`,
          },
          {
            status: 422,
          }
        );
      }

      if (
        !Number.isFinite(
          item.avg_cost
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              `avg_cost item PLU ${item.plu} tidak valid`,
          },
          {
            status: 422,
          }
        );
      }
    }

    // Hilangkan field index karena bukan bagian body upstream
    const cleanData = data.map(
      ({ index, ...item }) => item
    );

    const payload = {
      kodeToko,
      dateSo,
      rakSo,
      data: cleanData,
    };

    console.log(
      "================================="
    );

    console.log(
      "SAVE ENTRY KKSO PAYLOAD"
    );

    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    console.log(
      "================================="
    );

    // =================================================
    // REQUEST KE SERVER ASLI
    // =================================================
    const upstream =
      await fetch(TARGET_URL, {
        method: "POST",

        headers:
          alfaHeaders(kodeToko),

        body:
          JSON.stringify(payload),

        cache: "no-store",
      });

    const raw =
      await upstream.text();

    let result: any;

    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        raw,
      };
    }

    console.log(
      "SAVE ENTRY UPSTREAM STATUS:",
      upstream.status
    );

    console.log(
      "SAVE ENTRY UPSTREAM RESPONSE:",
      result
    );

    // =================================================
    // ERROR DARI ALFASTORE
    // JANGAN DIUBAH MENJADI HTTP 200
    // =================================================
    if (!upstream.ok) {
      return NextResponse.json(
        {
          success: false,

          upstreamStatus:
            upstream.status,

          message:
            result?.infoMsg ??
            result?.message ??
            result?.error ??
            "Save Entry KKSO ditolak server",

          upstream:
            result,

          request: {
            kodeToko,
            dateSo,
            rakSo,
            jumlahItem:
              cleanData.length,
          },
        },
        {
          status:
            upstream.status >= 400 &&
            upstream.status <= 599
              ? upstream.status
              : 502,
        }
      );
    }

    // =================================================
    // SUKSES
    // Screenshot server asli menggunakan 201 Created
    // =================================================
    return NextResponse.json(
      {
        success: true,

        upstreamStatus:
          upstream.status,

        infoMsg:
          result?.infoMsg ??
          "Berhasil Simpan Entry KKSO",

        response:
          result,
      },
      {
        status: upstream.status,
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

        message:
          "Route gagal menghubungi server Alfastore",

        error:
          error?.message ??
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// GET HANYA CEK ROUTE
// =====================================================
export async function GET(
  req: NextRequest
) {
  const {
    searchParams,
  } = new URL(req.url);

  const storeId =
    searchParams.get(
      "storeId"
    ) ?? "";

  const date =
    searchParams.get(
      "date"
    ) ?? "";

  return NextResponse.json(
    {
      success: true,

      api:
        "save-entry-kkso",

      endpoint:
        "/api/save-entry",

      method:
        "POST",

      storeId,
      date,

      target:
        "save_entry_kkso",

      message:
        "Route aktif. POST diperlukan untuk menyimpan Entry KKSO.",
    },
    {
      status: 200,
    }
  );
}
