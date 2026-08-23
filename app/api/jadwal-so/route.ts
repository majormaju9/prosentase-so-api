import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/get_jadwal";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } = new URL(request.url);

    const storeId = searchParams.get("storeId");
    const dateSo = searchParams.get("dateSo");


    if (!storeId || !dateSo) {
      return NextResponse.json(
        {
          success:false,
          message:"storeId dan dateSo wajib diisi"
        },
        {
          status:400
        }
      );
    }


    const apiUrl =
      `${ALFASTORE_URL}`+
      `?storeId=${encodeURIComponent(storeId)}`+
      `&dateSo=${encodeURIComponent(dateSo)}`;


    const response = await fetch(apiUrl,{
      method:"GET",
      headers:{
        "App-Name":"CEXP-CLOUD",
        "Accept":"application/json"
      },
      cache:"no-store"
    });


    const data = await response.text();


    if(!response.ok){
      return NextResponse.json(
        {
          success:false,
          message:"AlfaStore API error",
          status:response.status,
          data
        },
        {
          status:response.status
        }
      );
    }


    let result;

    try{
      result = JSON.parse(data);
    }catch{
      result = data;
    }


    return NextResponse.json({
      success:true,
      storeId,
      dateSo,
      data:result
    });


  }catch(error){

    return NextResponse.json(
      {
        success:false,
        message:"Gagal mengambil jadwal SO",
        error:
          error instanceof Error
          ? error.message
          : String(error)
      },
      {
        status:500
      }
    );

  }

}
