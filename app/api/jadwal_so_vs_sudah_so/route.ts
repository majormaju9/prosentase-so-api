import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/jadwal_so_vs_sudah_so";


export async function GET(request: NextRequest) {

  try {

    const { searchParams } =
      new URL(request.url);


    const storeId =
      searchParams.get("storeId");

    const dateSo =
      searchParams.get("dateSo");


    if (!storeId || !dateSo) {

      return new NextResponse(
        "storeId dan dateSo wajib diisi",
        {
          status:400
        }
      );

    }



    const apiUrl =
      `${ALFASTORE_URL}` +
      `?storeId=${storeId}` +
      `&dateSo=${dateSo}`;



    const response =
      await fetch(apiUrl, {

        method:"GET",

        headers:{

          "App-Name":"SO-PDA",

          "Version-App":
          "V.2026.04.13.01-alfa",

          "Version-Code":"28",

          "User-Agent":
          "Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",

          "Platform":"ANDROID",

          "Api-Key":
          "ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",

          "Accept-Encoding":"gzip",

          "Connection":"Keep-Alive",

        }

      });



    const data =
      await response.json();



    /*
      menyesuaikan jika API memakai
      data / result / items
    */

    const rows =
      data.data ||
      data.result ||
      data.items ||
      [];




    let tableRows = "";



    if(Array.isArray(rows)) {


      tableRows =
      rows.map((item:any,index:number)=>`

      <tr>

        <td>${index+1}</td>

        <td>${item.storeId ?? storeId}</td>

        <td>${item.dateSo ?? dateSo}</td>

        <td>${item.kodeBarang ?? item.productCode ?? "-"}</td>

        <td>${item.namaBarang ?? item.productName ?? "-"}</td>

        <td>${item.qtyJadwal ?? item.qty ?? 0}</td>

        <td>${item.qtySudahSo ?? item.qtySo ?? 0}</td>

        <td>
        ${
          (item.qtySudahSo ?? 0) > 0
          ? "Sudah SO"
          : "Belum SO"
        }
        </td>

      </tr>

      `).join("");

    }



    const html = `

<!DOCTYPE html>

<html>

<head>

<title>
Laporan SO VS Sudah SO
</title>


<style>

body{

font-family:
Arial, sans-serif;

padding:20px;

}


h2{

text-align:center;

}



table{

width:100%;

border-collapse:collapse;

font-size:14px;

}



th{

background:#1976d2;

color:white;

padding:10px;

}



td{

border:1px solid #ddd;

padding:8px;

text-align:center;

}



tr:nth-child(even){

background:#f5f5f5;

}



.info{

margin-bottom:20px;

}

</style>


</head>



<body>


<h2>
Laporan Jadwal SO VS Sudah SO
</h2>


<div class="info">

<b>Store:</b> ${storeId}

<br>

<b>Tanggal SO:</b> ${dateSo}

</div>



<table>


<thead>

<tr>

<th>No</th>

<th>Store</th>

<th>Tanggal</th>

<th>Kode Barang</th>

<th>Nama Barang</th>

<th>Qty Jadwal</th>

<th>Qty Sudah SO</th>

<th>Status</th>


</tr>

</thead>



<tbody>

${tableRows || 

`
<tr>
<td colspan="8">
Data tidak ditemukan
</td>
</tr>
`

}

</tbody>



</table>


</body>

</html>


`;



    return new NextResponse(
      html,
      {
        headers:{
          "Content-Type":
          "text/html"
        }
      }
    );




  } catch(error){


    return NextResponse.json(

      {

        success:false,

        message:
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
