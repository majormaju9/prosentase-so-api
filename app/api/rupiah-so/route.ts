import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";



function optimizeHtml(html: string) {

  return html

    // hapus script agar tidak error di proxy
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )

    // tambahan css ringan tanpa merusak tabel asli
    .replace(
      "</head>",
      `

<style>

body {

    margin:0;
    padding:10px;

    font-family:Arial, Helvetica, sans-serif;

}


/* pertahankan tabel asli */

table {

    border-collapse:collapse !important;

}


td,
th {

    border-color:#000 !important;

}


/* tampilan mobile */

@media(max-width:768px){

    body{

        zoom:0.85;

    }


    table{

        width:100% !important;

    }


    td,
    th{

        font-size:10px !important;

        padding:3px !important;

    }

}


</style>

</head>`
    );

}



export async function GET(
    request: NextRequest
){


try{


    const {
        searchParams
    } = new URL(request.url);



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
                "storeId, periode1, periode2 wajib diisi"

            },
            {
                status:400
            }
        );

    }



    const apiUrl =

        `${ALFASTORE_URL}` +

        `?storeId=${encodeURIComponent(storeId)}` +

        `&periode1=${encodeURIComponent(periode1)}` +

        `&periode2=${encodeURIComponent(periode2)}`;



    const response =

        await fetch(

            apiUrl,

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



    return new NextResponse(

        response.ok
        ?
        optimizeHtml(html)
        :
        html,

        {

            status:response.status,


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


    return NextResponse.json(

        {

            success:false,


            message:
            "Gagal mengambil laporan prosentase SO",


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
