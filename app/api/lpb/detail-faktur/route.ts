import { NextRequest } from "next/server";


const ALFASTORE_URL =
"https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/get_det_faktur/";


export async function POST(request: NextRequest) {

try {


const body = await request.json();


const response = await fetch(
  ALFASTORE_URL,
  {

    method:"POST",

    headers:{

      "App-Name":"LPB-CLOUD",

      "Version-App":"V.2025.11.25.04",

      "Version-Code":"30",

      "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 15)",

      "App-Uid":"23067884",

      "Store-Id":
      body.storeId,

      "Api-Key":
      "ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",

      "AndroidId":
      "712f8db18eeb1816",

      "Platform":"ANDROID",

      "Accept":"application/json",

      "Content-Type":
      "application/json"

    },


    body:JSON.stringify({

      storeId:
      body.storeId,

      faktur:
      body.faktur

    }),


    cache:"no-store"

  }
);



const result =
await response.text();



return new Response(
result,
{

status:response.status,

headers:{

"Content-Type":
"application/json",

"Cache-Control":
"no-store"

}

}
);



}
catch(error){


return Response.json(
{

success:false,

message:"LPB Error",

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
