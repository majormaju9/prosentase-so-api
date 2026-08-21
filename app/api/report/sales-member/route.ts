import { NextRequest, NextResponse } from "next/server";

const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan/laporan_sales_member";


function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
}


export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);

    const storeId =
      searchParams.get("storeId") || "M604";

    const userId =
      searchParams.get("userId") || "23067884";

    const periode1 =
      searchParams.get("periode1") || "29-04-2026";

    const periode2 =
      searchParams.get("periode2") || "29-04-2026";


    const apiUrl = new URL(ALFASTORE_URL);

    apiUrl.searchParams.set(
      "storeId",
      storeId
    );

    apiUrl.searchParams.set(
      "userId",
      userId
    );

    apiUrl.searchParams.set(
      "periode1",
      periode1
    );

    apiUrl.searchParams.set(
      "periode2",
      periode2
    );


    const response = await fetch(
      apiUrl.toString(),
      {
        headers: {

          "Accept":
            "text/html,application/xhtml+xml",

          "User-Agent":
            "Dalvik/2.1.0 (Linux; Android 15)",

          "Api-Key":
            process.env.ALFA_API_KEY || "",

          "App-Name":
            "CEXP-CLOUD",

          "App-Uid":
            "10365",

          "Store-Id":
            storeId,

          "User-Id":
            userId,

          "Platform":
            "ANDROID",

          "Version-App":
            "2025.05.20.1",

          "Version-Code":
            "9"
        }
      }
    );


    const html = await response.text();


    const finalHtml = `
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<title>Laporan Sales Member</title>

<meta name="viewport" content="width=device-width, initial-scale=1">

<style>

body {
    font-family: Arial, sans-serif;
    background:#f5f5f5;
    padding:20px;
}

.container {
    background:white;
    padding:20px;
    border-radius:10px;
    overflow:auto;
}

table {
    width:100%;
    border-collapse:collapse;
    font-size:14px;
}

table th {
    background:#0066cc;
    color:white;
    padding:10px;
}

table td {
    border:1px solid #ddd;
    padding:8px;
}

tr:nth-child(even){
    background:#f9f9f9;
}

h2 {
    text-align:center;
}

</style>

</head>


<body>


<div class="container">

<h2>
Laporan Sales Member
</h2>


<div>
<b>Store :</b> ${storeId}
<br>
<b>User :</b> ${userId}
<br>
<b>Periode :</b> ${periode1} s/d ${periode2}
</div>

<hr>


${cleanHtml(html)}


</div>


</body>

</html>
`;


    return new NextResponse(
      finalHtml,
      {
        status:200,
        headers:{
          "Content-Type":
          "text/html; charset=utf-8"
        }
      }
    );


  } catch(error:any){

    return new NextResponse(
`
<h2>Error</h2>
<p>${error.message}</p>
`,
{
status:500,
headers:{
"Content-Type":"text/html"
}
}
);

  }
}
