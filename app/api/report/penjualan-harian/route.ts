import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get("storeId");
    const periode1 = searchParams.get("periode1");

    if (!storeId || !periode1) {
      return NextResponse.json(
        {
          error: "storeId dan periode1 wajib diisi"
        },
        { status: 400 }
      );
    }

    const url =
      `https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_harian_penjualan_toko` +
      `?storeId=${storeId}` +
      `&periode1=${periode1}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message
      },
      { status: 500 }
    );
  }
}
