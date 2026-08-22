import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/report/daily-performance",
    message: "ROUTE AKTIF"
  });
}
