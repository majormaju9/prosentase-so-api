import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/register_dokumen_toko_NR";


function fixHtml(html: string) {

  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(
      /<link[^>]*>/gi,
      ""
    )
    .replace(
      /<style[^>]*>[\s\S]*?<\/style>/gi,
      ""
    )
    +
    `
<style>

body {

  margin:0;
  padding:10px;

  background:white;

  font-family:
  Arial,
  Helvetica,
  sans-serif;

}


table {

  border-collapse:collapse !important;

  width:100% !important;

}


td,
th {

  border:1px solid #000 !important;

  padding:3px !important;

  font-size:11px !important;

}


th {

  text-align:center;

  font-weight:bold;

}


@media(max-width:600px){

body{

 transform:scale(0.95);

 transform-origin:top left;

 width:105%;

}


td,
th{

 font-size:9px !important;

 padding:2px !important;

}

}


</style>

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


const periode1 =
searchParams.get("periode1");


const periode2 =
searchParams.get("periode2");



if(
 !storeId ||
 !periode1 ||
 !periode2
){

return NextResponse.json(
{

success:false,

message:
"storeId, periode1, periode2 wajib"

},
{
status:400
}
);

}



const url =
`${ALFASTORE_URL}`+
`?storeId=${storeId}`+
`&periode1=${periode1}`+
`&periode2=${periode2}`;



const response =
await fetch(
url,
{

method:"GET",

headers:{

"App-Name":
"CEXP-CLOUD"

},

cache:"no-store"

}
);



const html =
await response.text();



if(!response.ok){

return new NextResponse(
html,
{
status:response.status,
headers:{
"Content-Type":
"text/html"
}
}
);

}



const result =
fixHtml(html);



return new NextResponse(
result,
{

status:200,

headers:{

"Content-Type":
"text/html; charset=utf-8",

"Cache-Control":
"no-store"

}

}
);



}catch(error){


return NextResponse.json(
{

success:false,

message:
"Gagal mengambil laporan NR",

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
