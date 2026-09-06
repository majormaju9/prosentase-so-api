import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";


function cleanHtmlText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}


function escapeHtml(value: string) {
  return value
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}


function convertTable(html:string){

  const tableMatch = html.match(
    /<table[\s\S]*?<\/table>/i
  );


  if(!tableMatch){
    throw new Error("Tabel AlfaStore tidak ditemukan");
  }


  const table = tableMatch[0];


  const tbodyMatch = table.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i
  );


  if(!tbodyMatch){
    throw new Error("tbody tidak ditemukan");
  }


  const tbody = tbodyMatch[1];


  const rows:string[]=[];


  const rowRegex=/<tr[^>]*>([\s\S]*?)<\/tr>/gi;


  let row;


  let nomor=1;


  while((row=rowRegex.exec(tbody))!==null){

    const cells:string[]=[];


    const tdRegex=/<td[^>]*>([\s\S]*?)<\/td>/gi;


    let td;


    while((td=tdRegex.exec(row[1]))!==null){
      cells.push(
        cleanHtmlText(td[1])
      );
    }


    if(cells.length<8) continue;



    rows.push(`

<tr>

<td class="no">
${nomor++}
</td>

<td class="plu">
${escapeHtml(cells[0])}
</td>


<td class="desc">
${escapeHtml(cells[1])}
</td>


<td class="rak">
${escapeHtml(cells[5])}
</td>


<td class="angka">
${escapeHtml(cells[6])}
</td>


<td class="angka">
${escapeHtml(cells[7])}
</td>


</tr>

`);

  }



return `


<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">


<style>


body{

font-family:Arial, sans-serif;
font-size:12px;
margin:0;
background:white;

}


table{

width:100%;
border-collapse:collapse;

}


thead th{

background:#eeeeee;
border:1px solid #bdbdbd;
padding:5px;

font-weight:bold;
text-align:center;

}


tbody td{

border:1px solid #d0d0d0;
padding:4px;

}



tbody tr:nth-child(even){

background:#fafafa;

}


.no{

width:35px;
text-align:center;

}



.plu{

width:80px;

}


.desc{

text-align:left;

}


.rak{

text-align:center;
width:70px;

}


.angka{

text-align:right;
width:90px;

}



</style>


</head>


<body>


<table>


<thead>

<tr>

<th>No</th>

<th>PLU</th>

<th>Deskripsi</th>

<th>Rak</th>

<th>Fisik</th>

<th>Selisih</th>

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
request:NextRequest
){


try{


const {searchParams}=new URL(request.url);



const storeId=searchParams.get("storeId");
const dateSo=searchParams.get("dateSo");



if(!storeId || !dateSo){

return NextResponse.json({

success:false,
message:"storeId dan dateSo wajib"

},{status:400});

}



const url=

`${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}&dateSo=${encodeURIComponent(dateSo)}`;



const res=await fetch(url,{

method:"GET",

headers:{


"Accept":"text/html",

"Api-Key":process.env.ALFA_API_KEY || "",


"App-Name":"SO-PDA",

"Version-App":"V.2026.04.13.01-alfa",

"Version-Code":"28",


"User-Agent":
"Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


"User-Id":
process.env.ALFA_USER_ID || "23067884",


"Store-Id":
storeId,


"Branch-Id":
process.env.ALFA_BRANCH_ID || "MZ01",


"Ip-Addr":"10.1.10.1"

},

cache:"no-store"

});



const html=await res.text();



if(!res.ok){

return NextResponse.json({

success:false,
status:res.status,
raw:html

},{status:res.status});

}



return NextResponse.json({

success:true,

table:convertTable(html)

});


}catch(err){


return NextResponse.json({

success:false,

message:
err instanceof Error ? err.message : String(err)

},{status:500});


}


}
