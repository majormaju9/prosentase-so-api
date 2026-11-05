/**
 * Simpan sebagai app/api/backup-data-transaksi/route.ts
 * POST /api/backup-data-transaksi?filename=NAMA_BACKUP.zip
 * Kirim body upload dan Content-Type sesuai format yang diterima API asli.
 * Body diteruskan apa adanya (tidak dikonversi ke JSON atau multipart).
 * Tidak memuat kredensial bawaan dan tidak melewati autentikasi server asal.
 * Terapkan autentikasi aplikasi Anda pada route ini sebelum dipublikasikan.
 */
export const runtime = "nodejs";

const ENDPOINT =
  "https://app.alfastore.co.id/prd/api/pos/transaksi/clerek/backup_data_transaksi";
const DEFAULT_FILENAME = "M604_2026-11-04_24067944_android.zip";

/** GET hanya menampilkan formulir; unggahan dilakukan setelah tombol ditekan. */
export async function GET(): Promise<Response> {
  return new Response(`<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unggah Backup POS</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef5ff;color:#17304f;font:16px system-ui,sans-serif;padding:32px 16px}
main{max-width:620px;margin:4vh auto;background:white;padding:28px;border-radius:20px;box-shadow:0 12px 40px #163b6b14}
h1{margin:0 0 12px;color:#1764cf;font-size:26px}p{line-height:1.6;color:#53667b}
label{display:block;font-weight:600;margin:20px 0 8px}input,button{width:100%;padding:13px;border-radius:10px;font:inherit}
input{border:1px solid #cbd9eb;background:#fafcff}button{border:0;background:#1764cf;color:white;font-weight:700;margin-top:24px;cursor:pointer}
button:disabled{opacity:.55;cursor:wait}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6fa;border-radius:10px;padding:16px;font-size:13px}
.note{font-size:13px}#status{font-weight:600}
</style></head><body><main>
<h1>Unggah Backup POS</h1>
<p>Pilih file ZIP untuk dikirim ke server POS. Halaman ini digunakan untuk mengunggah backup.</p>
<form id="uploadForm">
<label for="backupFile">File backup ZIP</label>
<input id="backupFile" type="file" accept=".zip,application/zip" required>
<label for="filename">Nama file tujuan</label>
<input id="filename" type="text" maxlength="200" placeholder="Nama file .zip" required autocomplete="off">
<button id="submitButton" type="submit">Unggah backup</button>
</form>
<p class="note">Server asal tetap memerlukan autentikasi sesuai ketentuannya. Unggahan dapat ditolak jika autentikasi atau format file belum sesuai.</p>
<p id="status" role="status" aria-live="polite"></p>
<pre id="result" hidden></pre>
</main><script>
const form=document.getElementById('uploadForm');
const fileInput=document.getElementById('backupFile');
const nameInput=document.getElementById('filename');
const button=document.getElementById('submitButton');
const statusText=document.getElementById('status');
const result=document.getElementById('result');
const requestedName=new URL(location.href).searchParams.get('filename');
nameInput.value=requestedName||'';
fileInput.addEventListener('change',()=>{
  const file=fileInput.files[0];
  if(file&&!requestedName)nameInput.value=file.name;
});
form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const file=fileInput.files[0];
  if(!file||!file.size){statusText.textContent='Pilih file ZIP yang tidak kosong.';return;}
  button.disabled=true;result.hidden=true;
  statusText.textContent='Mengirim backup, tunggu respons server…';
  const url=new URL(location.href);
  url.search='';url.searchParams.set('filename',nameInput.value.trim());
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});
    const text=await response.text();
    statusText.textContent='Respons server: HTTP '+response.status+'.';
    try{result.textContent=JSON.stringify(JSON.parse(text),null,2);}
    catch{result.textContent=text||'(Respons kosong)';}
    result.hidden=false;
  }catch{
    statusText.textContent='Koneksi terputus. Periksa status backup sebelum mengirim ulang.';
  }finally{button.disabled=false;}
});
</script></body></html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const filename = new URL(request.url).searchParams.get("filename") ?? DEFAULT_FILENAME;

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,195}\.zip$/i.test(filename)) {
    return Response.json(
      { ok: false, message: "filename harus berupa nama file .zip tanpa path." },
      { status: 400 },
    );
  }
  if (!request.body || request.headers.get("content-length") === "0") {
    return Response.json(
      { ok: false, message: "Kirim isi file backup melalui body POST." },
      { status: 400 },
    );
  }

  const target = new URL(ENDPOINT);
  target.searchParams.set("filename", filename);

  const headers = new Headers();
  // Hanya header terkait request API, bukan Cookie/Host milik situs proxy.
  for (const name of ["content-type", "accept", "authorization", "x-api-key", "x-store-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/octet-stream");
  }

  try {
    // Streaming menghindari penampungan seluruh ZIP dalam memori.
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      headers,
      body: request.body,
      duplex: "half",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    };
    const upstream = await fetch(target, options);

    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return Response.json(
        { ok: false, message: "Server asal mengembalikan redirect; unggahan tidak diulang otomatis." },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of ["content-type", "content-disposition", "retry-after", "www-authenticate"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    // Pertahankan status dan respons asli, termasuk respons non-JSON.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        ok: false,
        message: timeout
          ? "Server asal tidak merespons dalam 30 detik. Periksa status backup sebelum mencoba lagi."
          : "Pengiriman ke server asal terputus atau gagal. Periksa status backup sebelum mencoba lagi.",
      },
      { status: timeout ? 504 : 502 },
    );
  }
}
