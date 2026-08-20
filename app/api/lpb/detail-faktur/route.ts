import { NextRequest } from "next/server";


const ALFASTORE_URL =
"https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_det_faktur/";


async function callAlfaStore(
  storeId:string,
  faktur:string
){

const response =
await fetch(
  ALFASTORE_URL,
  {

    method:"POST",

    headers:{

      "App-Name":"LPB-CLOUD",

      "Version-App":
      "V.2025.11.25.04",

      "Version-Code":
      "30",

      "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15)",

      "App-Uid":
      "23067884",

      "Store-Id":
      storeId,

      "Api-Key":
      "ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",

      "AndroidId":
      "712f8db18eeb1816",

      "Platform":
      "ANDROID",

      "Content-Type":
      "application/json",

      "Accept":
      "application/json"

    },


    body:JSON.stringify({

      storeId,
      faktur

    }),


    cache:"no-store"

  }
);


return response;

}



export async function GET(
request:NextRequest
){

const {searchParams}
=
new URL(request.url);


const storeId =
searchParams.get("storeId");

const faktur =
searchParams.get("faktur");


if(!storeId || !faktur){

return Response.json(
{
message:
"storeId dan faktur wajib"
},
{
status:400
}
);

}


const response =
await callAlfaStore(
storeId,
faktur
);


const result =
await response.text();


return new Response(
result,
{
status:response.status,
headers:{
"Content-Type":
"application/json"
}
}
);


}



export async function POST(
request:NextRequest
){

const body =
await request.json();


const response =
await callAlfaStore(
body.storeId,
body.faktur
);


const result =
await response.text();


return new Response(
result,
{
status:response.status,
headers:{
"Content-Type":
"application/json"
}
}
);

}
