import { NextRequest, NextResponse } from "next/server";

const RACK_URL =
  "https://mobile-crun-svc-2jwb2b2p3a-et.a.run.app/tablet/productinfo/CheckPerRack/";

const PRODUCT_DETAIL_URL =
  "https://app.alfastore.co.id/prd/api/mob/tablet/cekexpired/get_product_detail/";

const CONCURRENCY_LIMIT = 6;

const BASE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Api-Key": "iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",
  "App-Name": "CEXP-CLOUD",
  "App-Uid": "10267",
  "Branch-Id": "KZ01",
  "Class-Store": "A",
  "Company-Id": "SAT",
  Platform: "ANDROID",
  "User-Id": "20068688",
  "Version-App": "2024.08.13.1",
  "Version-Code": "6",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const storeIdParam = searchParams.get("storeId");
    const rackParam = searchParams.get("rack");

    if (!storeIdParam || !rackParam) {
      return NextResponse.json(
        {
          error: "storeId dan rack wajib diisi",
        },
        { status: 400 }
      );
    }

    // Setelah pengecekan di atas TypeScript tahu keduanya string.
    const storeId: string = storeIdParam;
    const rack: string = rackParam;

    // Contoh:
    // AA1
    // AA1 - REG BEVERAGES 1
    //
    // Keduanya akan menjadi:
    // AA1
    const rackCode: string =
      rack.split(" - ")[0]?.trim() || rack;

    /* =============================
       STEP 1 – Ambil Data Rack
    ============================== */

    const rackUrl =
      `${RACK_URL}` +
      `?storeId=${encodeURIComponent(storeId)}` +
      `&rack=${encodeURIComponent(rackCode)}`;

    const rackRes = await fetch(rackUrl, {
      method: "GET",

      headers: {
        ...BASE_HEADERS,
        "Store-Id": storeId,
      },

      cache: "no-store",
    });

    const rackText = await rackRes.text();

    let rackData: any;

    try {
      rackData = JSON.parse(rackText);
    } catch {
      return NextResponse.json(
        {
          error: "Response CheckPerRack bukan JSON",
          raw: rackText,
        },
        {
          status: rackRes.status || 502,
        }
      );
    }

    if (!rackRes.ok) {
      return NextResponse.json(
        {
          error: "Gagal mengambil data rack",
          status: rackRes.status,
          data: rackData,
        },
        {
          status: rackRes.status,
        }
      );
    }

    const rows: any[] = Array.isArray(rackData?.data)
      ? rackData.data
      : Array.isArray(rackData)
        ? rackData
        : [];

    if (!rows.length) {
      return NextResponse.json([]);
    }

    /* =============================
       STEP 2 – Unique PLU
    ============================== */

    const uniquePlus: string[] = Array.from(
      new Set(
        rows
          .map((item: any) =>
            item.plunya ?? item.plu
          )
          .filter(
            (value: unknown): value is string | number =>
              typeof value === "string" ||
              typeof value === "number"
          )
          .map((value: string | number) =>
            String(value)
          )
      )
    );

    /* =============================
       STEP 3 – Product Map
    ============================== */

    const productMap: Record<
      string,
      {
        onhand: number | string;
        barcode: string | number;
      }
    > = {};

    let index = 0;

    /* =============================
       STEP 4 – Worker Pool
    ============================== */

    async function worker(): Promise<void> {
      while (true) {
        const currentIndex = index++;

        if (
          currentIndex >= uniquePlus.length
        ) {
          break;
        }

        const plu: string =
          uniquePlus[currentIndex];

        try {
          const detailUrl =
            `${PRODUCT_DETAIL_URL}` +
            `?storeId=${encodeURIComponent(storeId)}` +
            `&plu=${encodeURIComponent(plu)}`;

          const detailRes = await fetch(
            detailUrl,
            {
              method: "GET",

              headers: {
                ...BASE_HEADERS,
                "Store-Id": storeId,
                "User-Agent": "Mozilla/5.0",
              },

              cache: "no-store",
            }
          );

          const text =
            await detailRes.text();

          let data: any = null;

          try {
            data = JSON.parse(text);
          } catch {
            data = null;
          }

          let product: any = {};

          if (
            Array.isArray(data) &&
            data.length > 0
          ) {
            product = data[0];
          } else if (
            typeof data === "object" &&
            data !== null
          ) {
            product = data;
          }

          productMap[plu] = {
            onhand:
              product?.onhand ?? 0,

            barcode:
              product?.barcode ?? "",
          };
        } catch (error) {
          console.error(
            `Gagal mengambil detail PLU ${plu}:`,
            error
          );

          productMap[plu] = {
            onhand: 0,
            barcode: "",
          };
        }
      }
    }

    const workerCount: number = Math.min(
      CONCURRENCY_LIMIT,
      uniquePlus.length
    );

    const workers: Promise<void>[] =
      Array.from(
        {
          length: workerCount,
        },
        () => worker()
      );

    await Promise.all(workers);

    /* =============================
       STEP 5 – Merge ke Rack
    ============================== */

    const finalData: any[] = rows.map(
      (item: any) => {
        const plu: string = String(
          item.plunya ??
            item.plu ??
            ""
        );

        return {
          ...item,

          onhand:
            productMap[plu]?.onhand ??
            0,

          barcode:
            productMap[plu]?.barcode ??
            "",
        };
      }
    );

    /* =============================
       STEP 6 – Response
       ARRAY LANGSUNG
       kompatibel dengan RN lama
    ============================== */

    return NextResponse.json(finalData);
  } catch (error) {
    console.error(
      "RACK DETAIL ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Gagal ambil rack",
        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
