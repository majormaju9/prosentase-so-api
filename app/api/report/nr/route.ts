import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/register_dokumen_toko_NR";


function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function convertAlfaStoreHtml(html: string): string {

  const tableMatch = html.match(
    /<table[^>]*class=["'][^"']*datatable[^"']*["'][^>]*>[\s\S]*?<\/table>/i
  );


  if (!tableMatch) {
    throw new Error("Tabel Register Dokumen NR tidak ditemukan");
  }


  const sourceTable = tableMatch[0];


  const tbodyMatch = sourceTable.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i
  );


  if (!tbodyMatch) {
    throw new Error("tbody tidak ditemukan");
  }


  const tbody = tbodyMatch[1];


  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;


  const rows:string[] = [];


  let rowMatch:RegExpExecArray|null;


  while ((rowMatch = rowRegex.exec(tbody)) !== null) {

    const rowHtml = rowMatch[1];

    const cells:string[] = [];

    tdRegex.lastIndex = 0;


    let cellMatch:RegExpExecArray|null;


    while ((cellMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(cleanHtmlText(cellMatch[1]));
    }


    if (cells.length === 0) {
      continue;
    }


    /*
      Register Dokumen NR biasanya:
      
      0 = No
      1 = Tanggal
      2 = Nomor Dokumen
      3 = Keterangan
      4 = Nilai

      Sesuaikan jika hasil AlfaStore berbeda.
    */


    rows.push(`
      <tr>
        ${cells.map(
          item => `<td>${escapeHtml(item)}</td>`
        ).join("")}
      </tr>
    `);

  }



  return `
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<title>
Register Dokumen NR
</title>


<style>

table.datatable {
 border-collapse:collapse;
 width:100%;
 font-family:Arial;
 font-size:12px;
}


.datatable th {

 border:1px solid black;
 padding:5px;
 text-align:center;
 background:#eee;

}


.datatable td {

 border:1px solid black;
 padding:4px;

}


</style>


</head>


<body>


<table class="datatable">

<thead>

<tr>

<th>No</th>
<th>Tanggal</th>
<th>No Dokumen</th>
<th>Keterangan</th>
<th>Nilai</th>

</tr>

</thead>


<tbody>

${rows.join("\n")}

</tbody>


</table>


</body>

</html>
`;

}



export async function GET(request:NextRequest){

try{


const {searchParams}=new URL(request.url);


const storeId =
searchParams.get("storeId");


const periode1 =
searchParams.get("periode1");


const periode2 =
searchParams.get("periode2");



if(!storeId || !periode1 || !periode2){

return NextResponse.json(
{
success:false,
message:
"storeId, periode1 dan periode2 wajib diisi"
},
{
status:400
}
);

}



const apiUrl =
`${ALFASTORE_URL}`+
`?storeId=${encodeURIComponent(storeId)}`+
`&periode1=${encodeURIComponent(periode1)}`+
`&periode2=${encodeURIComponent(periode2)}`;



const response =
await fetch(apiUrl,{

method:"GET",

headers:{
"App-Name":"CEXP-CLOUD"
},

cache:"no-store"

});



const originalHtml =
await response.text();



if(!response.ok){

return NextResponse.json(
{
success:false,
message:"AlfaStore API error",
status:response.status,
table:originalHtml
},
{
status:response.status
}
);

}



const convertedHtml =
convertAlfaStoreHtml(originalHtml);



return NextResponse.json({

success:true,

table:convertedHtml

});



}catch(error){


console.error(
"REPORT NR ERROR:",
error
);



return NextResponse.json(

{
success:false,
message:
"Gagal mengambil laporan Register Dokumen NR",

error:
error instanceof Error
?
error.message
:
String(error)

},

{
status:500
}

);


}

}
