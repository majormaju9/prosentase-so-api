import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

// =============================================
// HEADER ALFASTORE
// =============================================
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

    AndroidId:
      "712f8db18eeb1816",

    "Branch-Id":
      "MZ01",

    "Class-Store": "",

    "Company-Id": "",

    "Company-Ext": "",

    Platform:
      "ANDROID",

    "Mac-Addr":
      "712f8db18eeb1816",

    "Content-Type":
      "application/json; charset=utf-8",
  };
}

// =============================================
// POST
// =============================================
export async function POST(req: NextRequest) {
  const started = Date.now();

  try {
    // =========================================
    // BACA BODY
    // =========================================
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body JSON tidak valid",
        },
        {
          status: 200,
        }
      );
    }

    // =========================================
    // PARAMETER
    // =========================================
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

    // =========================================
    // VALIDASI
    // =========================================
    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message:
            "kodeToko/storeId kosong",
        },
        {
          status: 200,
        }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "dateSo/date kosong",
        },
        {
          status: 200,
        }
      );
    }

    if (!rakSo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "rakSo kosong",
        },
        {
          status: 200,
        }
      );
    }

    if (
      sourceData.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data item kosong",
        },
        {
          status: 200,
        }
      );
    }

    // =========================================
    // NORMALISASI SELURUH ITEM
    // =========================================
    const data = sourceData.map(
      (item: any) => ({
        plu: Number(
          item.plu ?? 0
        ),

        descp: String(
          item.descp ??
            item.description ??
            item.nama ??
            ""
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
          item.barcode ??
            item.barCode ??
            ""
        ),

        tag: String(
          item.tag ?? ""
        ),

        qty: String(
          item.qty ??
            item.jumlah ??
            "0"
        ),

        avg_cost: Number(
          item.avg_cost ??
            item.avgCost ??
            0
        ),
      })
    );

    // =========================================
    // CEK PLU
    // =========================================
    const invalidPlu =
      data.find(
        (item) =>
          !Number.isFinite(
            item.plu
          ) ||
          item.plu <= 0
      );

    if (invalidPlu) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Terdapat PLU tidak valid",

          item:
            invalidPlu,
        },
        {
          status: 200,
        }
      );
    }

    // =========================================
    // PAYLOAD
    //
    // PENTING:
    // SEMUA ITEM DIKIRIM SEKALI
    // BUKAN 62 FETCH
    // =========================================
    const payload = {
      kodeToko,
      dateSo,
      rakSo,
      data,
    };

    console.log(
      "================================="
    );

    console.log(
      "SAVE ENTRY KKSO"
    );

    console.log(
      "STORE:",
      kodeToko
    );

    console.log(
      "DATE:",
      dateSo
    );

    console.log(
      "RAK:",
      rakSo
    );

    console.log(
      "TOTAL ITEM:",
      data.length
    );

    console.log(
      "================================="
    );

    // =========================================
    // SATU REQUEST KE ALFASTORE
    // =========================================
    let upstream: Response;

    try {
      upstream =
        await fetch(
          TARGET_URL,
          {
            method: "POST",

            headers:
              getHeaders(
                kodeToko
              ),

            body:
              JSON.stringify(
                payload
              ),

            cache:
              "no-store",

            // Jangan sampai route menggantung
            // lebih lama dari caller PHP
            signal:
              AbortSignal.timeout(
                20000
              ),
          }
        );
    } catch (error: any) {
      const elapsed =
        Date.now() -
        started;

      const isTimeout =
        error?.name ===
          "TimeoutError" ||
        error?.name ===
          "AbortError";

      return NextResponse.json(
        {
          success: false,

          message:
            isTimeout
              ? "Server Alfastore timeout saat Save Entry KKSO"
              : "Gagal menghubungi server Alfastore",

          timeout:
            isTimeout,

          elapsedMs:
            elapsed,

          error:
            error?.message ??
            String(error),

          request: {
            kodeToko,
            dateSo,
            rakSo,
            totalItem:
              data.length,
          },
        },
        {
          // Transport tetap 200 supaya PHP
          // menerima JSON, bukan HTTP error.
          status: 200,
        }
      );
    }

    // =========================================
    // RESPONSE
    // =========================================
    const raw =
      await upstream.text();

    let result: any;

    try {
      result =
        JSON.parse(raw);
    } catch {
      result = {
        raw,
      };
    }

    const elapsed =
      Date.now() -
      started;

    console.log(
      "UPSTREAM STATUS:",
      upstream.status
    );

    console.log(
      "UPSTREAM RESPONSE:",
      result
    );

    console.log(
      "TIME:",
      elapsed,
      "ms"
    );

    // =========================================
    // DETEKSI SUKSES
    // =========================================
    const infoMsg =
      String(
        result?.infoMsg ??
          result?.message ??
          ""
      );

    const success =
      upstream.ok &&
      (
        upstream.status ===
          201 ||
        /berhasil/i.test(
          infoMsg
        )
      );

    if (!success) {
      return NextResponse.json(
        {
          success: false,

          message:
            result?.infoMsg ??
            result?.message ??
            "Save Entry KKSO gagal",

          upstreamStatus:
            upstream.status,

          elapsedMs:
            elapsed,

          request: {
            kodeToko,
            dateSo,
            rakSo,
            totalItem:
              data.length,
          },

          response:
            result,
        },
        {
          status: 200,
        }
      );
    }

    // =========================================
    // BERHASIL
    // =========================================
    return NextResponse.json(
      {
        success: true,

        message:
          result?.infoMsg ??
          "Berhasil Simpan Entry KKSO",

        upstreamStatus:
          upstream.status,

        kodeToko,
        dateSo,
        rakSo,

        totalItem:
          data.length,

        elapsedMs:
          elapsed,

        response:
          result,
      },
      {
        status: 200,
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,

        message:
          "Internal error Save Entry",

        error:
          error?.message ??
          String(error),

        elapsedMs:
          Date.now() -
          started,
      },
      {
        status: 200,
      }
    );
  }
}

// =============================================
// GET HANYA CEK ROUTE
// =============================================
export async function GET(
  req: NextRequest
) {
  const { searchParams } =
    new URL(req.url);

  return NextResponse.json({
    success: true,

    api:
      "save-entry",

    method:
      "POST",

    storeId:
      searchParams.get(
        "storeId"
      ) ?? "",

    date:
      searchParams.get(
        "date"
      ) ?? "",

    message:
      "Route aktif. Semua item dikirim dalam satu request.",
  });
}
