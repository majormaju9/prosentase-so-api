// src/routes/router.ts

import { Router, Request, Response } from "express";

const router = Router();

const ALFASTORE_BASE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan";

router.get("/daily_performance", async (req: Request, res: Response) => {
  try {
    const { storeId, periode1, periode2 } = req.query;

    if (!storeId || !periode1 || !periode2) {
      return res.status(400).json({
        success: false,
        message:
          "Parameter storeId, periode1, dan periode2 wajib diisi",
      });
    }

    const params = new URLSearchParams({
      storeId: String(storeId),
      periode1: String(periode1),
      periode2: String(periode2),
    });

    const originalUrl =
      `${ALFASTORE_BASE_URL}/daily_performance?${params.toString()}`;

    const response = await fetch(originalUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    let data: any;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return res.status(response.status).send(data);
  } catch (error) {
    console.error("Daily Performance Error:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil Daily Performance",
    });
  }
});

export default router;
