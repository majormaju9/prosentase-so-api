import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/TotalFaktur/";

function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
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


function convertLPBHtml(html: string): string {

  const tableMatch = html.match(
    /<table[\s\S]*?<\/table>/i
  );


  if (!tableMatch) {
    throw new Error("Tabel LPB tidak ditemukan");
  }


  const table = tableMatch[0];


  const rows: string[] = [];


  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;


  while ((rowMatch = rowRegex.exec(table)) !== null) {

    const rowHtml = rowMatch[1];


    const cells:string[]=[];


    const tdRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;


    let cellMatch;


    while((cellMatch = tdRegex.exec(rowHtml)) !== null){

      cells.push(
        cleanHtmlText(cellMatch[2])
      );

    }


    if(cells.length){

      rows.push(`
        <tr>
          ${cells.map(
            c=>`<td>${escapeHtml(c)}</td>`
          ).join("")}
        </tr>
      `);

    }

  }



  return `
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<style>

table.datatable{
width:100%;
border-collapse:collapse;
font-size:12px;
}

.datatable td,
.datatable th{

border:1px solid black;
padding:4px;

}

</style>


</head>


<body>


<table class="datatable">


<thead>

<tr>

<th>Data</th>

</tr>

</thead>


<tbody>

${rows.join("")}


</tbody>


</table>


</body>

</html>

`;

}



export async function GET(
request: NextRequest
){

try{


const {searchParams}=new URL(request.url);


const storeId =
searchParams.get("storeId");


const faktur =
searchParams.get("faktur");



if(!storeId || !faktur){

return NextResponse.json({

success:false,

message:
"storeId dan faktur wajib diisi"

},
{
status:400
});

}



const apiUrl =
`${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}&faktur=${encodeURIComponent(faktur)}`;



const response =
await fetch(apiUrl,{

method:"GET",

headers:{


"App-Name":
"LPB-CLOUD",


"Version-App":
"V.2025.11.25.04",


"Version-Code":
"30",


"User-Agent":
"Dalvik/2.1.0 (Linux; U; Android 15)",


"User-Id":
"23067884",


"Store-Id":
storeId,


"Api-Key":
"ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",


"AndroidId":
"712f8db18eeb1816",


"Platform":
"ANDROID",


"Host":
"app.alfastore.co.id",


"Connection":
"Keep-Alive",


"Accept-Encoding":
"gzip"

},


cache:"no-store"


});



const html =
await response.text();



if(!response.ok){

return NextResponse.json({

success:false,

status:
response.status,

response:html

},
{
status:response.status
});

}



const converted =
convertLPBHtml(html);



return NextResponse.json({

table:
converted

});



}
catch(error){


console.error(
"LPB ERROR",
error
);



return NextResponse.json({

success:false,

message:
"Gagal mengambil data LPB",

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
