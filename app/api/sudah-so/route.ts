import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/jadwal_so_vs_sudah_so";


function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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
    throw new Error(
      "Tabel jadwal SO AlfaStore tidak ditemukan"
    );
  }


  const sourceTable = tableMatch[0];


  const tbodyMatch = sourceTable.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i
  );


  if (!tbodyMatch) {
    throw new Error(
      "tbody AlfaStore tidak ditemukan"
    );
  }


  const tbody = tbodyMatch[1];


  const rowRegex =
    /<tr[^>]*>([\s\S]*?)<\/tr>/gi;


  const tdRegex =
    /<td[^>]*>([\s\S]*?)<\/td>/gi;


  const rows:string[] = [];


  let rowMatch;


  while(
    (rowMatch = rowRegex.exec(tbody)) !== null
  ){

    const rowHtml = rowMatch[1];

    const cells:string[]=[];


    tdRegex.lastIndex = 0;


    let cellMatch;


    while(
      (cellMatch = tdRegex.exec(rowHtml)) !== null
    ){

      cells.push(
        cleanHtmlText(cellMatch[1])
      );

    }


    if(cells.length === 0)
      continue;



    rows.push(`
      <tr>
        ${cells.map(cell=>`
          <td>
            ${escapeHtml(cell)}
          </td>
        `).join("")}
      </tr>
    `);

  }



  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">


<style>

table.datatable{

border-collapse:collapse;
width:100%;
font-family:Arial;
font-size:12px;

}


.datatable th{

border:1px solid black;
padding:5px;
text-align:center;
background:#eee;

}


.datatable td{

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
<th>Data</th>

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



export async function GET(
request:NextRequest
){

try{


const {
searchParams
}=new URL(request.url);



const storeId =
searchParams.get("storeId");


const beginDate =
searchParams.get("beginDate");


const endDate =
searchParams.get("endDate");



if(
!storeId ||
!beginDate ||
!endDate
){

return NextResponse.json({

success:false,

message:
"storeId, beginDate dan endDate wajib diisi"

},
{
status:400
});

}




const apiUrl =
`${ALFASTORE_URL}`+
`?storeId=${encodeURIComponent(storeId)}`+
`&beginDate=${encodeURIComponent(beginDate)}`+
`&endDate=${encodeURIComponent(endDate)}`;



const response =
await fetch(apiUrl,{

method:"GET",

headers:{

"App-Name":
"CEXP-CLOUD"

},

cache:"no-store"

});



const originalHtml =
await response.text();



if(!response.ok){

return NextResponse.json({

success:false,

message:
"AlfaStore API error",

status:
response.status,

table:
originalHtml

},
{
status:
response.status
});

}



const table =
convertAlfaStoreHtml(originalHtml);



return NextResponse.json({

success:true,

table

});



}catch(error){


console.error(
"JADWAL SO ERROR:",
error
);



return NextResponse.json({

success:false,

message:
"Gagal mengambil laporan jadwal SO",

error:
error instanceof Error
?
error.message
:
String(error)

},
{
status:500
});


}


}
