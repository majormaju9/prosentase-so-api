import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {

  try {

    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        message: "Method tidak diizinkan"
      });
    }


    const { storeId } = req.query;


    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi"
      });
    }


    const url = `${API_URL}?storeId=${storeId}`;


    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });


    const result = await response.json();


    return res.status(200).json({
      success: true,
      endpoint: "jadwal-so",
      storeId,
      data: result
    });


  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil jadwal SO",
      error: error.message
    });

  }

}
