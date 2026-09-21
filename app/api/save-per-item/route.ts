import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";
const ALFASTORE_ENTRY_URL =
  "https://app.alfastore.co.id/prd/api/so/entry_kkso";

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

    if (!rakSo) {
      return NextResponse.json(
        {
          success: false,
          message: "rakSo wajib ada untuk menyimpan per item."
        },
        { status: 400 }
      );
    }

    if (data.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: "save_per_item hanya menerima tepat satu barang."
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

    // Header identitas harus sama untuk membuka entry rak dan menyimpan item.
    // Server Alfastore mengikat lock rak pada identitas perangkat ini.
    const deviceHeaders = {
      "App-Name": "SO-PDA",
      "Version-App": "V.2026.04.13.01-alfa",
      "Version-Code": "28",
      Platform: "ANDROID",
      "Mac-Addr": process.env.ALFASTORE_MAC_ADDR ?? "712f8db18eeb1816",
      "Api-Key": apiKey,
      "User-Agent":
        "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      Connection: "Keep-Alive"
    };

    const saveItem = () =>
      fetch(ALFASTORE_URL, {
        method: "POST",
        headers: {
          ...deviceHeaders,
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(payload),
        cache: "no-store"
      });

    let upstreamResponse = await saveItem();
    let responseText = await upstreamResponse.text();
    let lockRefreshed = false;

    // 406 ini tidak berarti format JSON salah. Pesan tersebut berarti lock rak
    // dimiliki sesi/perangkat lain atau belum dibuat. Buka kembali entry rak
    // dengan identitas yang sama, kemudian retry tepat satu kali. POST pertama
    // ditolak sehingga retry ini tidak menggandakan QTY.
    if (
      upstreamResponse.status === 406 &&
      /rak[\s\S]*(tidak\s*)?terkunci|mengunci\s*rak/i.test(responseText)
    ) {
      const entryUrl = new URL(ALFASTORE_ENTRY_URL);
      entryUrl.searchParams.set("kodeToko", kodeToko);
      entryUrl.searchParams.set("dateSo", payload.dateSo);
      entryUrl.searchParams.set("rakSo", rakSo);

      const lockResponse = await fetch(entryUrl, {
        method: "GET",
        headers: deviceHeaders,
        cache: "no-store"
      });

      // Hanya retry bila server menerima proses entry/lock rak.
      if (lockResponse.ok) {
        await lockResponse.arrayBuffer();
        lockRefreshed = true;
        upstreamResponse = await saveItem();
        responseText = await upstreamResponse.text();
      }
    }

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
          ? "QTY barang berhasil disimpan per item."
          : "Server Alfastore menolak penyimpanan barang.",
        data: upstreamData,
        lockRefreshed
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
