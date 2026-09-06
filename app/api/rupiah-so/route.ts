import { NextRequest, NextResponse } from "next/server";


const ALFASTORE_URL =
  "https://app.alfastore.co.id/prd/api/rpt/laporan_so/prosentase_so";



function optimizeHtml(html: string) {

  return html

    // hapus javascript agar aman di proxy
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )


    // tambah style tanpa merusak tampilan asli
    .replace(
      "</head>",
      `

<style>

body {

    margin:0;
    padding:10px;

    font-family:Arial, Helvetica, sans-serif;

}


/* tabel asli AlfaStore */

table {

    border-collapse:collapse !important;

}


td,
th {

    border-color:#000 !important;

}


/* responsive */

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
) {


try {


    const { searchParams } =
        new URL(request.url);



    // teruskan semua parameter
    const queryString =
        searchParams.toString();



    if(!queryString){

        return NextResponse.json(
            {

                success:false,

                message:
                "Parameter laporan belum diberikan"

            },
            {
                status:400
            }
        );

    }



    const apiUrl =
        `${ALFASTORE_URL}?${queryString}`;



    const response =
        await fetch(

            apiUrl,

            {

                method:"GET",


                headers:{

                    "App-Name":
                    "CEXP-CLOUD",


                    "User-Agent":
                    "Mozilla/5.0"

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
