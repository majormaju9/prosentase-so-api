import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";

function parseJsonValue(value: unknown): unknown {
  let result = value;

  // Menangani JSON yang ter-stringify satu atau dua kali.
  for (let i = 0; i < 2 && typeof result === "string"; i++) {
    try {
      result = JSON.parse(result);
    } catch {
      break;
    }
  }

  return result;
}

function normalizeData(value: unknown): Record<string, unknown>[] {
  const parsed = parseJsonValue(value);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is Record<string, unknown> =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item)
    );
  }

  // Jika data dikirim sebagai satu objek, ubah menjadi array.
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
  ) {
    return [parsed as Record<string, unknown>];
  }

  return [];
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();

  // Mendukung format YYYY-MM-DD dari input HTML.
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return trimmed;
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "API save_per_item aktif. Gunakan POST.",
      format: {
        kodeToko: "M604",
        dateSo: "21-09-2026",
        rakSo: "GB2",
        data: [
          {
            plu: 451390,
            descp: "NAMA BARANG",
            conv1: 0,
            conv2: 0,
            subdept: 0,
            barcode: "899446113418",
            tag: "M",
            qty: "1",
            avg_cost: 65550
          }
        ]
      }
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    let rawBody: unknown;

    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Body request harus berupa JSON yang valid."
        },
        { status: 400 }
      );
    }

    const parsedBody = parseJsonValue(rawBody);

    if (
      parsedBody === null ||
      typeof parsedBody !== "object" ||
      Array.isArray(parsedBody)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Body request harus berupa objek JSON."
        },
        { status: 400 }
      );
    }

    const body = parsedBody as Record<string, unknown>;
    const { searchParams } = new URL(request.url);

    const kodeToko = String(
      body.kodeToko ??
      body.storeId ??
      searchParams.get("storeId") ??
      ""
    ).trim();

    const dateSoRaw = String(
      body.dateSo ??
      body.date ??
      searchParams.get("date") ??
      ""
    ).trim();

    const rakSo = String(
      body.rakSo ??
      body.rak ??
      ""
    ).trim();

    const data = normalizeData(body.data);

    if (!kodeToko || !dateSoRaw || data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "kodeToko, dateSo, dan data barang wajib ada. data harus berupa array objek.",
          received: {
            kodeToko,
            dateSo: dateSoRaw,
            dataType: Array.isArray(body.data)
              ? "array"
              : typeof body.data,
            itemCount: data.length
          }
        },
        { status: 400 }
      );
    }

    const invalidIndex = data.findIndex(
      (item) =>
        item.plu === undefined ||
        item.barcode === undefined ||
        item.qty === undefined
    );

    if (invalidIndex !== -1) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Barang pada index ${invalidIndex} wajib memiliki plu, barcode, dan qty.`
        },
        { status: 400 }
      );
    }

    const payload = {
      kodeToko,
      dateSo: normalizeDate(dateSoRaw),
      rakSo,
      data: data.map((item) => ({
        ...item,
        plu: Number(item.plu),
        descp: String(item.descp ?? ""),
        conv1: Number(item.conv1 ?? 0),
        conv2: Number(item.conv2 ?? 0),
        subdept: Number(item.subdept ?? 0),
        barcode: String(item.barcode),
        tag: String(item.tag ?? "M"),
        qty: String(item.qty),
        avg_cost: Number(item.avg_cost ?? 0)
      }))
    };

    const apiKey = process.env.ALFASTORE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ALFASTORE_API_KEY belum dipasang pada Environment Variables."
        },
        { status: 500 }
      );
    }

    const upstreamResponse = await fetch(ALFASTORE_URL, {
      method: "POST",
      headers: {
        "App-Name": "SO-PDA",
        "Version-App": "V.2026.04.13.01-alfa",
        "Version-Code": "28",
        Platform: "ANDROID",
        "Mac-Addr": "712f8db18eeb1816",
        "Api-Key": apiKey,
        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        Connection: "Keep-Alive",
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const responseText = await upstreamResponse.text();

    let upstreamData: unknown = responseText;

    if (responseText.trim()) {
      try {
        upstreamData = JSON.parse(responseText);
      } catch {
        // Biarkan dalam bentuk teks jika respons bukan JSON.
      }
    } else {
      upstreamData = null;
    }

    return NextResponse.json(
      {
        success: upstreamResponse.ok,
        status: upstreamResponse.status,
        message: upstreamResponse.ok
          ? "QTY barang berhasil dikirim ke server."
          : "Server Alfastore menolak penyimpanan barang.",
        data: upstreamData
      },
      {
        status: upstreamResponse.status,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("save-per-item error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server."
      },
      { status: 500 }
    );
  }
}
