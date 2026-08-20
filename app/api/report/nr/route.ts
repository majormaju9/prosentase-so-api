import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const storeId = searchParams.get("storeId");
    const periode1 = searchParams.get("periode1");
    const periode2 = searchParams.get("periode2");

    if (!storeId || !periode1 || !periode2) {
      return NextResponse.json(
        {
          status: false,
          message: "Parameter storeId, periode1, periode2 wajib diisi"
        },
        { status: 400 }
      );
    }

    const apiUrl =
      `https://app.alfastore.co.id/prd/api/rpt/laporan/register_dokumen_toko_NR` +
      `?storeId=${storeId}` +
      `&periode1=${periode1}` +
      `&periode2=${periode2}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: false,
          message: "Gagal mengambil data dari server Alfa",
          httpStatus: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      status: true,
      source: "register_dokumen_toko_NR",
      parameter: {
        storeId,
        periode1,
        periode2
      },
      data
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        status: false,
        message: error.message
      },
      { status: 500 }
    );
  }
}
