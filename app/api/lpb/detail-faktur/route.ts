import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {

  return Response.json({
    method:"GET aktif"
  });

}


export async function POST(request: NextRequest) {

  return Response.json({
    method:"POST aktif"
  });

}
