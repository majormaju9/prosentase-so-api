import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const items = Array.isArray(body.data)
      ? body.data
      : [];

    // ===============================
    // VALIDASI
    // ===============================

    if (!kodeToko) {
      return NextResponse.json(
        {
          success: false,
          message: "kodeToko/storeId kosong",
        },
        { status: 400 }
      );
    }

    if (!dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "dateSo/date kosong",
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

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Data item kosong",
        },
        { status: 400 }
      );
    }

    // ===============================
    // SIMPAN SATU PER SATU
    // ===============================

    const berhasil: any[] = [];
    const gagal: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const cleanItem = {
        plu: Number(item.plu),

        descp: String(
          item.descp ??
          item.description ??
          ""
        ),

        conv1: Number(item.conv1 ?? 0),
        conv2: Number(item.conv2 ?? 0),
        subdept: Number(item.subdept ?? 0),

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
      };

      // Jangan kirim item yang PLU-nya tidak valid
      if (
        !cleanItem.plu ||
        Number.isNaN(cleanItem.plu)
      ) {
        gagal.push({
          index: i,
          plu: item.plu,
          message: "PLU tidak valid",
        });

        continue;
      }

      const payload = {
        kodeToko,
        dateSo,
        rakSo,

        // PENTING:
        // hanya SATU item per request
        data: [cleanItem],
      };

      console.log(
        `SAVE ITEM ${i + 1}/${items.length}`,
        JSON.stringify(payload)
      );

      try {
        const upstream = await fetch(
          TARGET_URL,
          {
            method: "POST",

            headers:
              makeHeaders(kodeToko),

            body:
              JSON.stringify(payload),

            cache: "no-store",
          }
        );

        const raw =
          await upstream.text();

        let responseData: any;

        try {
          responseData =
            JSON.parse(raw);
        } catch {
          responseData = {
            raw,
          };
        }

        const infoMsg = String(
          responseData?.infoMsg ??
          responseData?.message ??
          ""
        );

        const benarBenarBerhasil =
          upstream.ok &&
          /berhasil/i.test(infoMsg);

        if (benarBenarBerhasil) {
          berhasil.push({
            plu: cleanItem.plu,
            status: upstream.status,
            response: responseData,
          });
        } else {
          gagal.push({
            plu: cleanItem.plu,
            status: upstream.status,
            response: responseData,
          });
        }
      } catch (error: any) {
        gagal.push({
          plu: cleanItem.plu,
          status: 0,
          message:
            error?.message ??
            String(error),
        });
      }

      // Jeda kecil supaya request tidak menumpuk
      if (i < items.length - 1) {
        await new Promise(
          (resolve) =>
            setTimeout(resolve, 80)
        );
      }
    }

    // ===============================
    // HASIL
    // ===============================

    if (gagal.length > 0) {
      return NextResponse.json(
        {
          success: false,

          message:
            `${berhasil.length} item berhasil, ` +
            `${gagal.length} item gagal disimpan.`,

          kodeToko,
          dateSo,
          rakSo,

          total:
            items.length,

          totalBerhasil:
            berhasil.length,

          totalGagal:
            gagal.length,

          berhasil,
          gagal,
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

        berhasil,
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

// Cek route dari browser
export async function GET(
  req: NextRequest
) {
  const { searchParams } =
    new URL(req.url);

  return NextResponse.json({
    success: true,
    api: "save-entry",
    method: "POST",

    storeId:
      searchParams.get("storeId") ??
      "",

    date:
      searchParams.get("date") ??
      "",

    message:
      "Route aktif. Save item dilakukan satu per satu.",
  });
}
