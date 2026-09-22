import { NextRequest, NextResponse } from "next/server";


const ALFA_URL =
"https://app.alfastore.co.id/prd/api/so/entry_kkso/save_per_item";



export async function GET(req: NextRequest){

const {searchParams}=new URL(req.url);


const kodeToko =
searchParams.get("storeId") || "M604";

const date =
searchParams.get("date") || "23-09-2026";


const payload={

kodeToko,

dateSo:date,

rakSo:"HB3",

data:[
{
plu:460947,
desc:"DELFI DAIRY MILK BOGOF 2X25G",
conv1:0,
conv2:0,
subdept:0,
barcode:"899100166346",
tag:"N",
qty:"1",
avg_cost:6354.81
}
]

};



try{


const alfa =
await fetch(ALFA_URL,{

method:"POST",

headers:{

"Content-Type":
"application/json",

"Api-Key":
"iVOZX9MLmKrj1L8R23uF1aryMR1vGMXG",

"User-Id":
"23067884",

"Store-Id":
kodeToko,

"Branch-Id":
"MZ01",

"Version-App":
"V.2026.04.13.01-alfa",

"Platform":
"ANDROID"

},

body:
JSON.stringify(payload)

});



const result =
await alfa.json();



return NextResponse.json({

request:payload,

alfaStatus:alfa.status,

response:result

});


}
catch(e:any){

return NextResponse.json({

error:e.message

},{status:500});


}

}
