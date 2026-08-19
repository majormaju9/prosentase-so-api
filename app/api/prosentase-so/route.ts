import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";

function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function convertAlfaStoreHtml(html: string): string {
  const tableMatch = html.match(
    /<table[^>]*class=["'][^"']*datatable[^"']*["'][^>]*>[\s\S]*?<\/table>/i
  );

  if (!tableMatch) {
    throw new Error("Tabel datatable AlfaStore tidak ditemukan");
  }

  const sourceTable = tableMatch[0];

  const tbodyMatch = sourceTable.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);

  if (!tbodyMatch) {
    throw new Error("tbody tabel AlfaStore tidak ditemukan");
  }

  const tbody = tbodyMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const rows: string[] = [];

  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];

    let cellMatch: RegExpExecArray | null;
    tdRegex.lastIndex = 0;

    while ((cellMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(cleanHtmlText(cellMatch[1]));
    }

    if (cells.length < 8) {
      continue;
    }

    const plu = cells[0];
    const nama = cells[1];
    const rack = cells[5];
    const stok = cells[6];
    const selisih = cells[7];

    rows.push(`
      <tr>
        <td>${escapeHtml(plu)}</td>
        <td>${escapeHtml(nama)}</td>
        <td>${escapeHtml(rack)}</td>
        <td>${escapeHtml(stok)}</td>
        <td>${escapeHtml(selisih)}</td>
      </tr>
    `);
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PROSENTASE STOCK OPNAME</title>

  <style>
    table.datatable {
      border-collapse: collapse;
      width: 100%;
    }

    .datatable th {
      border: 1px solid black;
      text-align: center;
      vertical-align: middle;
      padding: 3px;
    }

    .datatable td {
      border: 1px solid black;
      padding: 3px;
    }

    .numeric_text {
      text-align: right;
    }
  </style>
</head>

<body style="font-family:arial;font-size:12px;">
  <table class="datatable" width="100%">
    <thead>
      <tr>
        <th>PLU</th>
        <th>Deskripsi</th>
        <th>Rak</th>
        <th>Fisik</th>
        <th>Selisih</th>
      </tr>
    </thead>

    <tbody>
      ${rows.join("\n")}
    </tbody>
  </table>
</body>
</html>
`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const dateSo = searchParams.get("dateSo");

    if (!storeId || !dateSo) {
      return NextResponse.json(
        {
          success: false,
          message: "storeId dan dateSo wajib diisi",
        },
        { status: 400 }
      );
    }

    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&dateSo=${encodeURIComponent(dateSo)}`;

    const response = await fetch(apiUrl, {
      method: "GET",

      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",

        "Api-Key": process.env.ALFA_API_KEY || "",

        "App-Name": "CEXP-CLOUD",
        "App-Uid": process.env.ALFA_APP_UID || "",

        "Branch-Id": process.env.ALFA_BRANCH_ID || "",
        "Class-Store": process.env.ALFA_CLASS_STORE || "A",

        "Company-Ext": "",
        "Company-Id": process.env.ALFA_COMPANY_ID || "",

        "Ip-Addr": "0.0.0.0",

        "Mac-Addr": process.env.ALFA_MAC_ADDR || "",

        Platform: "ANDROID",

        "Shard-Id": "",

        Sn: process.env.ALFA_SN || "",

        "Store-Id": process.env.ALFA_STORE_ID || "",
        "Store-Id-Ext": "",

        "User-Id": process.env.ALFA_USER_ID || "",

        "Version-App": process.env.ALFA_VERSION_APP || "",
        "Version-Code": process.env.ALFA_VERSION_CODE || "",

        "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",
      },

      cache: "no-store",
    });

    const originalHtml = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "AlfaStore API error",
          status: response.status,
          table: originalHtml,
        },
        { status: response.status }
      );
    }

    const convertedHtml = convertAlfaStoreHtml(originalHtml);

    return NextResponse.json({
      table: convertedHtml,
    });
  } catch (error) {
    console.error("GERBANG LANGIT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil atau memproses data AlfaStore",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
