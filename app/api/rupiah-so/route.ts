import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
"https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";



function escapeHtml(str:string){

return str
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;");

}



function styleOriginalTable(html:string){


let table = html.match(
/<table[\s\S]*?<\/table>/i
);


if(!table){

throw new Error(
"Tabel prosentase SO tidak ditemukan"
);

}



let result = table[0];



result=result.replace(
"<table",
`
<table class="datatable"
`
);



return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">


<style>


body{

margin:0;
padding:0;

font-family:Arial,Helvetica,sans-serif;

font-size:12px;

color:#222;

}



.datatable{

width:100%;

border-collapse:collapse;

background:white;

}



.datatable thead th{

background:#e9e9e9;

border:1px solid #bdbdbd;

padding:5px 4px;

text-align:center;

font-weight:bold;

white-space:nowrap;

}



.datatable tbody td{


border:1px solid #d5d5d5;

padding:4px;

}



.datatable tbody tr:nth-child(even){

background:#fafafa;

}



.datatable tbody tr:hover{

background:#eeeeee;

}



.numeric_text{

text-align:right!important;

}



.text-center{

text-align:center!important;

}



</style>


</head>


<body>


${result}


</body>


</html>

`;

}





export async function GET(
req:NextRequest
){


try{


const {searchParams}=new URL(req.url);



const storeId =
searchParams.get("storeId");


const dateSo =
searchParams.get("dateSo");



if(!storeId || !dateSo){


return NextResponse.json({

success:false,

message:
"storeId dan dateSo wajib"

},{status:400});


}





const url =

`${ALFASTORE_URL}`+
`?storeId=${encodeURIComponent(storeId)}`+
`&dateSo=${encodeURIComponent(dateSo)}`;




const response = await fetch(url,{

method:"GET",


headers:{


"Accept":
"text/html,application/xhtml+xml",


"Api-Key":
process.env.ALFA_API_KEY || "",


"App-Name":
"SO-PDA",


"Version-App":
"V.2026.04.13.01-alfa",


"Version-Code":
"28",


"User-Agent":
"Dalvik/2.1.0 (Linux; U; Android 11; PM75 Build/RKQ1.210518.002)",


"User-Id":
process.env.ALFA_USER_ID || "23067884",


"Store-Id":
storeId,


"Branch-Id":
process.env.ALFA_BRANCH_ID || "MZ01",


"Ip-Addr":
"10.1.10.1"

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

raw:
html.substring(0,1000)

},{status:response.status});


}





const table =
styleOriginalTable(html);





return NextResponse.json({

success:true,

table

});





}catch(error){



return NextResponse.json({

success:false,

message:
error instanceof Error
? error.message
:String(error)

},{status:500});


}


}
