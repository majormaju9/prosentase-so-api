import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TARGET_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_entry_kkso";

const API_KEY =
  "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG";

function headers(storeId: string) {
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

    "Api-Key": API_KEY,

    AndroidId: "712f8db18eeb1816",

    "Branch-Id": "MZ01",
    "Class-Store": "",

    "Company-Id": "",
    "Company-Ext": "",

    Platform: "ANDROID",

    "Mac-Addr": "712f8db18eeb1816",

    "Content-Type":
      "application/json; charset=utf-8",
  };
}

function pick(
  obj: any,
  names: string[],
  fallback: any = undefined
) {
  for (const name of names) {
    if (
      obj?.[name] !== undefined &&
      obj?.[name] !== null
    ) {
      return obj[name];
    }
  }

  // coba case-insensitive
  const keys = Object.keys(obj || {});

  for (const wanted of names) {
    const found = keys.find(
      (k) =>
        k.toLowerCase() ===
        wanted.toLowerCase()
    );

    if (
      found &&
      obj[found] !== undefined &&
      obj[found] !== null
    ) {
      return obj[found];
    }
  }

  return fallback;
}

function normalizeItem(item: any) {
  return {
    plu: Number(
      pick(item, [
        "plu",
        "PLU",
        "kodePlu",
        "kode_plu",
      ])
    ),

    descp: String(
      pick(
        item,
        [
          "descp",
          "DESCp",
          "description",
          "desc",
          "nama",
          "namaBarang",
          "nama_barang",
        ],
        ""
      )
    ).trim(),

    conv1: Number(
      pick(
        item,
        ["conv1", "CONV1"],
        0
      )
    ),

    conv2: Number(
      pick(
        item,
        ["conv2", "CONV2"],
        0
      )
    ),

    subdept: Number(
      pick(
        item,
        [
          "subdept",
          "subDept",
          "SUBDEPT",
          "sub_department",
        ],
        0
      )
    ),

    barcode: String(
      pick(
        item,
        [
          "barcode",
          "barCode",
          "BARCODE",
          "ean",
        ],
        ""
      )
    ).trim(),

    tag: String(
      pick(
        item,
        [
          "tag",
          "TAG",
          "flag",
          "tipe",
        ],
        ""
      )
    ).trim(),

    qty: String(
      pick(
        item,
        [
          "qty",
          "QTY",
          "jumlah",
          "quantity",
        ],
        ""
      )
    ),

    avg_cost: Number(
      pick(
        item,
        [
          "avg_cost",
          "avgCost",
          "AVG_COST",
          "avgcost",
          "cost",
        ]
      )
    ),
  };
}

export async function POST(
  req: NextRequest
) {
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

    const sourceItems =
      Array.isArray(body.data)
        ? body.data
        : [];

    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message:
            "kodeToko/storeId kosong",
        },
        { status: 400 }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message:
            "dateSo/date kosong",
        },
        { status: 400 }
      );
    }

    if (!rakSo) {
      return NextResponse.json(
        {
          success: false,
          message: "rakSo kosong",
        },
        { status: 400 }
      );
    }

    if (
      sourceItems.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Data barang kosong",
        },
        { status: 400 }
      );
    }

    const items =
      sourceItems.map(
        normalizeItem
      );

    // ====================================
    // CEK DATA WAJIB
    // ====================================

    const invalidItems =
      items
        .map((item, index) => {
          const missing: string[] =
            [];

          if (
            !Number.isFinite(
              item.plu
            ) ||
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

          if (item.qty === "") {
            missing.push("qty");
          }

          if (
            !Number.isFinite(
              item.avg_cost
            )
          ) {
            missing.push(
              "avg_cost"
            );
          }

          if (
            missing.length === 0
          ) {
            return null;
          }

          return {
            index,
            plu: item.plu,
            missing,
            original:
              sourceItems[index],
          };
        })
        .filter(Boolean);

    // Jangan kirim 62 request kalau
    // data dasarnya ternyata tidak lengkap.
    if (
      invalidItems.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `${invalidItems.length} item memiliki data tidak lengkap.`,

          kodeToko,
          dateSo,
          rakSo,

          total:
            items.length,

          contohError:
            invalidItems.slice(
              0,
              10
            ),

          hint:
            "Pastikan frontend mengirim barcode, tag, avg_cost, descp, conv1, conv2 dan subdept dari data asli rak.",
        },
        {
          status: 422,
        }
      );
    }

    // ====================================
    // KIRIM 1 ITEM PER REQUEST
    // ====================================

    const berhasil: any[] = [];
    const gagal: any[] = [];

    for (
      let i = 0;
      i < items.length;
      i++
    ) {
      const item = items[i];

      const payload = {
        kodeToko,
        dateSo,
        rakSo,

        // SAMA SEPERTI CAPTURE
        // APP ASLI
        data: [item],
      };

      console.log(
        `[${i + 1}/${items.length}]`,
        JSON.stringify(payload)
      );

      try {
        const upstream =
          await fetch(
            TARGET_URL,
            {
              method: "POST",

              headers:
                headers(
                  kodeToko
                ),

              body:
                JSON.stringify(
                  payload
                ),

              cache:
                "no-store",
            }
          );

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

        console.log(
          "PLU:",
          item.plu,
          "STATUS:",
          upstream.status,
          "BODY:",
          result
        );

        const infoMsg =
          String(
            result?.infoMsg ??
            result?.message ??
            ""
          );

        // Capture Anda menunjukkan
        // HTTP 201 + infoMsg berhasil.
        if (
          upstream.status ===
            201 ||
          (
            upstream.ok &&
            /berhasil simpan entry kkso/i.test(
              infoMsg
            )
          )
        ) {
          berhasil.push({
            plu: item.plu,
            status:
              upstream.status,
            response:
              result,
          });
        } else {
          gagal.push({
            plu: item.plu,
            status:
              upstream.status,

            response:
              result,

            request:
              payload,
          });
        }
      } catch (error: any) {
        gagal.push({
          plu: item.plu,

          status: 0,

          error:
            error?.message ??
            String(error),

          request:
            payload,
        });
      }

      // jangan bombardir upstream
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            120
          )
      );
    }

    // ====================================
    // HASIL
    // ====================================

    if (
      gagal.length > 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `${berhasil.length} item berhasil, ${gagal.length} item gagal.`,

          kodeToko,
          dateSo,
          rakSo,

          total:
            items.length,

          totalBerhasil:
            berhasil.length,

          totalGagal:
            gagal.length,

          // tampilkan response asli
          // agar penyebab dapat dilihat
          gagal:
            gagal.slice(
              0,
              10
            ),

          berhasil:
            berhasil.slice(
              0,
              10
            ),
        },
        {
          status: 422,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        message:
          "Berhasil Simpan Entry KKSO",

        kodeToko,
        dateSo,
        rakSo,

        total:
          items.length,

        totalBerhasil:
          berhasil.length,

        totalGagal: 0,
      },
      {
        status: 200,
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
          "Gagal memproses Save Entry KKSO",

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
      "Route save-entry aktif.",
  });
}
