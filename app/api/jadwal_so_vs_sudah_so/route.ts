import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
"https://app.alfastore.co.id/prd/api/rpt/laporan_so/jadwal_so_vs_sudah_so";


export async function GET(request: NextRequest) {

try {


const {searchParams} =
new URL(request.url);


const storeId =
searchParams.get("storeId");


const dateSo =
searchParams.get("dateSo");



if(!storeId || !dateSo){

return new NextResponse(
"storeId dan dateSo wajib diisi",
{
status:400
}
);

}



const apiUrl =
`${ALFASTORE_URL}?storeId=${encodeURIComponent(storeId)}&dateSo=${encodeURIComponent(dateSo)}`;



const response =
await fetch(apiUrl,{

method:"GET",

headers:{


"App-Name":
"SO-PDA",

"Version-App":
"V.2026.04.13.01-alfa",

"Version-Code":
"28",

"User-Agent":
"Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


"Platform":
"ANDROID",


"Api-Key":
"ivOZx9MLmkrj1L8R23uFlaryMR1VGMXG",


"Accept":
"text/html",

"Connection":
"Keep-Alive"


},


cache:
"no-store"


});



const html =
await response.text();




return new NextResponse(
html,
{

status:
response.status,


headers:{

"Content-Type":
"text/html; charset=utf-8",


"Cache-Control":
"no-store"

}

}

);



}
catch(error){


return new NextResponse(

`
<html>
<body>

<h3>Error</h3>

<p>
${error instanceof Error
? error.message
: String(error)}
</p>

</body>
</html>
`

,
{
status:500,
headers:{
"Content-Type":"text/html"
}
}

);


}

}
