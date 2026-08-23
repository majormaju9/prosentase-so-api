import { Router, Request, Response } from "express";

const router = Router();

const ALFA_BASE_URL =
  "https://app.alfastore.co.id/prd/api/so/utility/get_jadwal";


/**
 * GET Jadwal SO
 * Contoh:
 * /api/so/jadwal?storeId=M604
 */
router.get("/so/jadwal", async (req: Request, res: Response) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId wajib diisi"
      });
    }


    const url = `${ALFA_BASE_URL}?storeId=${storeId}`;


    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0"
      }
    });


    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: "Gagal mengambil jadwal SO",
        status: response.status
      });
    }


    const data = await response.json();


    return res.json({
      success: true,
      storeId,
      data
    });


  } catch (error: any) {

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });

  }
});


export default router;
