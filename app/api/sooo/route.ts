/**
 * STOCK OPNAME V2 — 69 endpoint dari Stock_Opname_V2_API_Lengkap.txt.
 * Pasang: app/api/so/route.ts (Next.js App Router, Node runtime).
 *
 * ENV server (.env.local / Environment Variables Vercel):
 * SO_PROXY_TOKEN=token-acak-panjang-untuk-pemanggil-server (opsional)
 * SO_API_KEY=api-key-resmi-Anda
 * SO_UPSTREAM_HEADERS_JSON={"Version-App":"...","Version-Code":"...","User-Id":"...","Store-Id":"M604","Shard-Id":"..."}
 * SO_TIMEOUT_MS=25000 (opsional, 1000–55000 ms)
 * Header upstream lain sesuai sesi APK dapat dimasukkan dalam JSON di atas.
 * Jangan gunakan prefix NEXT_PUBLIC untuk rahasia. Panggil dari PHP/server Anda
 * dengan Authorization: Bearer <SO_PROXY_TOKEN> hanya jika env tersebut diisi.
 * Jika SO_PROXY_TOKEN kosong/tidak diatur, pemeriksaan token proxy dilewati.
 * Header API dari request (Api-Key, AndroidId, Branch-Id, Mac-Addr, dll)
 * diteruskan; konfigurasi environment server mengambil prioritas.
 * Authorization dan Cookie request tidak diteruskan. Token proxy tidak diteruskan.
 * Token ini memberikan akses ke seluruh endpoint; integrasikan otorisasi pengguna
 * pada backend pemanggil sebelum memakai proxy untuk banyak pengguna/toko.
 *
 * GET /api/so?action=list -> katalog 69 endpoint dan parameter.
 * GET /api/so?action=jadwal_so_vs_sudah_so&storeId=M604&dateSo=03-10-2026
 * GET /api/so?action=so/entry_kkso/get_data_entry&kodeToko=M604&dateSo=03-10-2026&rakSo=AU5
 * POST /api/so?action=so/check_entry/save_check_entry
 * Body: {"kodeToko":"M604","dateSo":"03-10-2026","rakList":["AU5"]}
 * DELETE /api/so?action=so/cetak_kkso/delete_tx_st_entry
 * Body: {"kodeToko":"M604","dateSo":"03-10-2026"}
 * Semua action menerima path lengkap tanpa /api/, atau nama terakhir jika unik.
 * Nama ambigu (get_all_rak, cek_tanggal, get_plu, save) harus pakai path lengkap.
 * Metode HTTP harus sesuai katalog; query bukan pengganti body POST/PUT/DELETE.
 *
 * dateSo: dd-MM-yyyy. clientDate JSON: yyyy-MM-dd HH:mm:ss.
 * clientDate query: nilai yang sama, di-encode dengan URLSearchParams.
 * Login password harus sudah Base64 tanpa newline; file ini tidak encode ulang.
 * nikPresensi: string array, misalnya [25090448]. Semua nilai di-URL-encode otomatis.
 * Tidak menebak NIK, lang, dcId, secLevel, atau tanggal yang tidak diberikan.
 * Field payload tidak dipangkas: data[], qty, plu, barcode, rack, faktor FM, dll
 * diteruskan apa adanya agar variasi alur KKSO/Entry tetap didukung.
 * Untuk data[] lengkap lihat bodyNotes dan payloadReference di action=list.
 *
 * Tidak ada retry otomatis (mencegah pengiriman operasi simpan dua kali).
 * Status/body JSON, HTML laporan, PDF diteruskan; redirect upstream ditolak.
 * GET tertentu juga dapat mengubah status di server sesuai perilaku APK.
 * Daftar berasal dari analisis statis APK, belum diuji terhadap server Alfastore.
 */
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Endpoint = {
  action: string;
  method: string;
  path: string;
  query: string[];
  defaults: Record<string, string>;
  bodyNotes: string;
};
const BASE = "https://app.alfastore.co.id/prd";
const MAX_BODY = 2 * 1024 * 1024;
const ENDPOINTS: Endpoint[] = [
  {
    "action": "sis/login",
    "method": "POST",
    "path": "/api/sis/login/",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): timeTx, userId, storeId, password, storeDate\nCatatan: storeDate dd/MM/yyyy; timeTx HH:mm:ss. Password di-Base64 lalu karakter newline dibuang."
  },
  {
    "action": "sis/master/status_toko",
    "method": "GET",
    "path": "/api/sis/master/status_toko/",
    "query": [
      "storeId"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/login/get_menu",
    "method": "GET",
    "path": "/api/so/login/get_menu",
    "query": [
      "storeId",
      "dateSo",
      "lang"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/utility/get_jadwal",
    "method": "GET",
    "path": "/api/so/utility/get_jadwal",
    "query": [
      "storeId"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/cek_tanggal",
    "method": "GET",
    "path": "/api/so/cetak_kkso/cek_tanggal",
    "query": [
      "storeId",
      "dateSo",
      "lang",
      "typeSo",
      "menuList",
      "clientDate"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/cek_so_type",
    "method": "GET",
    "path": "/api/so/cetak_kkso/cek_so_type",
    "query": [
      "storeId",
      "jenisSo",
      "secLevel",
      "locType",
      "lang",
      "userName",
      "clientDate",
      "dateSo",
      "menuSo",
      "nik"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_all_rak",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_all_rak",
    "query": [
      "storeId",
      "lang"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_all_rak_schedule",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_all_rak_schedule",
    "query": [
      "storeId",
      "lang"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_st_entry",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_st_entry",
    "query": [
      "storeId",
      "dateSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_rak_bebas",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_rak_bebas",
    "query": [
      "storeId",
      "rackNo",
      "userName"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_info",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_info",
    "query": [
      "storeId",
      "dateSo",
      "menuList",
      "clientDate",
      "tipeSo",
      "userSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/cek_rak",
    "method": "GET",
    "path": "/api/so/cetak_kkso/cek_rak",
    "query": [
      "storeId",
      "menuList",
      "rakSo",
      "lang",
      "dateSo",
      "remakeSo",
      "typeSo",
      "userSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/cek_plu_rak_bebas",
    "method": "GET",
    "path": "/api/so/cetak_kkso/cek_plu_rak_bebas",
    "query": [
      "storeId",
      "dateSo",
      "rakSo",
      "pluBarcode",
      "menuList",
      "lang",
      "deviceType",
      "userSo"
    ],
    "defaults": {
      "deviceType": "pda"
    },
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/get_all_plu",
    "method": "GET",
    "path": "/api/so/cetak_kkso/get_all_plu",
    "query": [
      "rakSo",
      "dateSo",
      "typeSo",
      "kodeToko",
      "userName"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/lock_menu_so_ic",
    "method": "GET",
    "path": "/api/so/cetak_kkso/lock_menu_so_ic",
    "query": [
      "storeId",
      "userId"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_kkso/save_data",
    "method": "POST",
    "path": "/api/so/cetak_kkso/save_data",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu, rakSo, data[], xInput; kondisional: deviceType, flagSave, userSo, beginDate, tmpEndDate, factorID, dateFmj\nCatatan: Lihat skema pembuatan KKSO dan varian save_data di bawah; field bergantung cabang UI."
  },
  {
    "action": "so/cetak_kkso/save_data_all",
    "method": "POST",
    "path": "/api/so/cetak_kkso/save_data_all",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu, rakSo, data[], xInput; kondisional: deviceType, flagSave, userSo, beginDate, tmpEndDate, factorID, dateFmj\nCatatan: Lihat skema pembuatan KKSO dan varian save_data di bawah; field bergantung cabang UI."
  },
  {
    "action": "so/customize_ic/save",
    "method": "POST",
    "path": "/api/so/customize_ic/save",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu, rakSo, data[], xInput; kondisional: deviceType, flagSave, userSo, beginDate, tmpEndDate, factorID, dateFmj\nCatatan: Lihat skema pembuatan KKSO dan varian save_data di bawah; field bergantung cabang UI."
  },
  {
    "action": "so/non_sales/save",
    "method": "POST",
    "path": "/api/so/non_sales/save",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu, rakSo, data[], xInput; kondisional: deviceType, flagSave, userSo, beginDate, tmpEndDate, factorID, dateFmj\nCatatan: Lihat skema pembuatan KKSO dan varian save_data di bawah; field bergantung cabang UI."
  },
  {
    "action": "so/st_shift/save",
    "method": "POST",
    "path": "/api/so/st_shift/save",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu, rakSo, data[], xInput; kondisional: deviceType, flagSave, userSo, beginDate, tmpEndDate, factorID, dateFmj\nCatatan: Lihat skema pembuatan KKSO dan varian save_data di bawah; field bergantung cabang UI."
  },
  {
    "action": "so/cetak_kkso/update_st_flag",
    "method": "PUT",
    "path": "/api/so/cetak_kkso/update_st_flag",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, menuList, menuSo, clientDate"
  },
  {
    "action": "so/cetak_kkso/delete_tx_st_entry",
    "method": "DELETE",
    "path": "/api/so/cetak_kkso/delete_tx_st_entry",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): kodeToko, dateSo"
  },
  {
    "action": "so/customize_ic/date_check",
    "method": "GET",
    "path": "/api/so/customize_ic/date_check",
    "query": [
      "storeId",
      "dateSo",
      "lang",
      "typeSo",
      "categorySo",
      "clientDate"
    ],
    "defaults": {
      "typeSo": "CUSTOMIZE"
    },
    "bodyNotes": ""
  },
  {
    "action": "so/customize_ic/get_item",
    "method": "GET",
    "path": "/api/so/customize_ic/get_item",
    "query": [
      "storeId",
      "dateSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/customize_ic/schedule",
    "method": "GET",
    "path": "/api/so/customize_ic/schedule",
    "query": [
      "storeId",
      "dateSo",
      "userId",
      "nikPresensi"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/non_sales/cek_tanggal",
    "method": "GET",
    "path": "/api/so/non_sales/cek_tanggal",
    "query": [
      "storeId",
      "dateSo",
      "lang",
      "typeSo",
      "menuList",
      "clientDate",
      "flagDelete",
      "flagRemake"
    ],
    "defaults": {
      "typeSo": "ITEM_NON_SALES",
      "flagDelete": "0",
      "flagRemake": "0"
    },
    "bodyNotes": ""
  },
  {
    "action": "so/non_sales/get_plu",
    "method": "GET",
    "path": "/api/so/non_sales/get_plu",
    "query": [
      "storeId",
      "dateSo",
      "beginDate",
      "endDate",
      "flagDelete"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/st_shift/cek_tanggal",
    "method": "GET",
    "path": "/api/so/st_shift/cek_tanggal",
    "query": [
      "storeId",
      "dateSo",
      "lang",
      "typeSo",
      "menuList",
      "clientDate"
    ],
    "defaults": {
      "typeSo": "SERAH_TERIMA_SHIFT"
    },
    "bodyNotes": ""
  },
  {
    "action": "so/st_shift/get_plu",
    "method": "GET",
    "path": "/api/so/st_shift/get_plu",
    "query": [
      "storeId",
      "dateSo",
      "rakSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/st_shift/get_shift",
    "method": "GET",
    "path": "/api/so/st_shift/get_shift",
    "query": [
      "storeId",
      "dateSo",
      "nik"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/check_date_entry",
    "method": "GET",
    "path": "/api/so/entry_kkso/check_date_entry",
    "query": [
      "storeId",
      "dateSo",
      "menuList",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/get_data_entry",
    "method": "GET",
    "path": "/api/so/entry_kkso/get_data_entry",
    "query": [
      "kodeToko",
      "dateSo",
      "rakSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/get_rak_tx_stEntry",
    "method": "GET",
    "path": "/api/so/entry_kkso/get_rak_tx_stEntry",
    "query": [
      "storeId",
      "dateSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/get_list_check_entry",
    "method": "GET",
    "path": "/api/so/entry_kkso/get_list_check_entry",
    "query": [
      "dateSo",
      "locType",
      "storeId",
      "offset",
      "limit"
    ],
    "defaults": {
      "offset": "0",
      "limit": "11"
    },
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/get_list_check_entry_st_pda",
    "method": "GET",
    "path": "/api/so/entry_kkso/get_list_check_entry_st_pda",
    "query": [
      "dateSo",
      "locType",
      "storeId",
      "offset",
      "limit"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/entry_kkso/save_entry_kkso",
    "method": "POST",
    "path": "/api/so/entry_kkso/save_entry_kkso",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): kodeToko, dateSo, rakSo, data[]\nCatatan: data[] skema entry; lihat rincian di bawah."
  },
  {
    "action": "so/entry_kkso/save_per_item",
    "method": "POST",
    "path": "/api/so/entry_kkso/save_per_item",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): kodeToko, dateSo, rakSo, data[]\nCatatan: data[] skema entry; lihat rincian di bawah."
  },
  {
    "action": "so/entry_kkso/save_cek_data_entry",
    "method": "POST",
    "path": "/api/so/entry_kkso/save_cek_data_entry",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): kodeToko, dateSo, data[]\nCatatan: data[]: avg_cost, barcode, date, f_tag, item_descp, plu, qty, rack, tag."
  },
  {
    "action": "so/entry_kkso/process_cek_data_entry",
    "method": "PUT",
    "path": "/api/so/entry_kkso/process_cek_data_entry",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, deviceType=\"pda\""
  },
  {
    "action": "so/check_entry/get_check_entry",
    "method": "GET",
    "path": "/api/so/check_entry/get_check_entry",
    "query": [
      "kodeToko",
      "dateSo",
      "locType"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/check_entry/save_check_entry",
    "method": "POST",
    "path": "/api/so/check_entry/save_check_entry",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): kodeToko, dateSo, rakList[]\nCatatan: rakList berisi string kode rak."
  },
  {
    "action": "so/edit_so/login_pic_edit",
    "method": "GET",
    "path": "/api/so/edit_so/login_pic_edit",
    "query": [
      "userId",
      "storeId",
      "password",
      "dateSo"
    ],
    "defaults": {},
    "bodyNotes": "Catatan: Password di-Base64 lalu karakter newline dibuang; URL-encode nilainya saat membangun URL."
  },
  {
    "action": "so/edit_so/get_list_rack",
    "method": "GET",
    "path": "/api/so/edit_so/get_list_rack",
    "query": [
      "storeId",
      "dateSo",
      "userId"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/edit_so/process_edit_new",
    "method": "POST",
    "path": "/api/so/edit_so/process_edit_new",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): storeId, dateSo, userId, listRack[], menuSo"
  },
  {
    "action": "so/edit_so/simpan_edit_so_firestore",
    "method": "POST",
    "path": "/api/so/edit_so/simpan_edit_so_firestore",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): clientDate, kodeToko, dateSo, menuList, data[], idCashier, typeSo\nCatatan: data[]: plu, descp, conv1, conv2, tag, avg_cost, barcode, qty."
  },
  {
    "action": "so/process/proses_so",
    "method": "POST",
    "path": "/api/so/process/proses_so",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): clientDate, dateSo, kodeToko, typeSo, menuList, eodAction, idCashier\nCatatan: eodAction ditemukan 0 atau 1 sesuai jalur UI."
  },
  {
    "action": "so/adjust/fixed_st",
    "method": "PUT",
    "path": "/api/so/adjust/fixed_st",
    "query": [],
    "defaults": {},
    "bodyNotes": "Body JSON (field yang ditemukan): clientDate, kodeToko, dateSo"
  },
  {
    "action": "so/cetak_selisih/check_menu_csel",
    "method": "GET",
    "path": "/api/so/cetak_selisih/check_menu_csel",
    "query": [
      "kodeToko",
      "clientDate"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_selisih/get_all_rak",
    "method": "GET",
    "path": "/api/so/cetak_selisih/get_all_rak",
    "query": [
      "kodeToko",
      "dateSo",
      "tipeRak",
      "jenisSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/cetak_selisih/process_printdifferenceso",
    "method": "GET",
    "path": "/api/so/cetak_selisih/process_printdifferenceso",
    "query": [
      "kodeToko",
      "dateSo",
      "menuList"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/report/get_rak",
    "method": "GET",
    "path": "/api/so/report/get_rak",
    "query": [
      "kodeToko",
      "lang"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "so/report/get_subdept",
    "method": "GET",
    "path": "/api/so/report/get_subdept",
    "query": [
      "kodeToko",
      "lang"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/jadwal_so_vs_sudah_so",
    "method": "GET",
    "path": "/api/rpt/laporan_so/jadwal_so_vs_sudah_so",
    "query": [
      "storeId",
      "dateSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/item_aktif_vs_item_sudah_so",
    "method": "GET",
    "path": "/api/rpt/laporan_so/item_aktif_vs_item_sudah_so",
    "query": [
      "storeId"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/report_rak_tidak_ada_jadwal",
    "method": "GET",
    "path": "/api/rpt/laporan_so/report_rak_tidak_ada_jadwal",
    "query": [
      "storeId",
      "rak"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/report_plu_tidak_ada_planogram",
    "method": "GET",
    "path": "/api/rpt/laporan_so/report_plu_tidak_ada_planogram",
    "query": [
      "storeId",
      "tipe",
      "subdept"
    ],
    "defaults": {
      "tipe": "subdept"
    },
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/prosentase_so",
    "method": "GET",
    "path": "/api/rpt/laporan_so/prosentase_so",
    "query": [
      "storeId",
      "dateSo",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_absolute_desc",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_absolute_desc",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_all_index_subdept_plu",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_all_index_subdept_plu",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_limit_absolute_desc",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_limit_absolute_desc",
    "query": [
      "storeId",
      "dateSo",
      "limitSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_limit_index_subdept_plu",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_limit_index_subdept_plu",
    "query": [
      "storeId",
      "dateSo",
      "limitSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_all_per_subdept",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_all_per_subdept",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_absolute_desc",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_absolute_desc",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_all_index_subdept_plu",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_all_index_subdept_plu",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_limit_absolute_desc",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_limit_absolute_desc",
    "query": [
      "storeId",
      "dateSo",
      "limitSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_limit_index_subdept_plu",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_limit_index_subdept_plu",
    "query": [
      "storeId",
      "dateSo",
      "limitSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_all_per_subdept",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_all_per_subdept",
    "query": [
      "storeId",
      "dateSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_all_so_per_rak",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_all_so_per_rak",
    "query": [
      "storeId",
      "dateSo",
      "rakSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  },
  {
    "action": "rpt/laporan_so/csel_last_so_per_subdept",
    "method": "GET",
    "path": "/api/rpt/laporan_so/csel_last_so_per_subdept",
    "query": [
      "storeId",
      "dateSo",
      "subdeptSo",
      "dcId",
      "typeSo"
    ],
    "defaults": {},
    "bodyNotes": ""
  }
];
const PAYLOAD_REFERENCE = "\nA. Pembuatan KKSO (save_data/save_data_all/customize_ic/save/non_sales/save/st_shift/save)\nField umum: storeId, dateSo, typeSo, categorySo, menuSo, userName, idCashier, stTipe, clientDate, menuList, nikKkso, menu.\nCabang per rak: rakSo, data[], xInput=0.\ndata[]: avg_cost, barcode, conv1, conv2, date_rec, descp, on_hand, plu, rack, subdept, tag, no_table.\nCabang ALL: deviceType=\"pda\", flagSave=0, userSo. Jangan menganggap data[] per-rak selalu ada.\nNon-sales menambah beginDate, tmpEndDate; stTipe=\"3\".\nShift: stTipe=\"3\" dan idCashier sesuai kasir pilihan.\nForce majeure: factorID, dateFmj, menu=\"cetak_kkso\"; selain itu menu=\"non_entry\".\n\nB. Varian cetak_kkso/save_data dari Entry SO (penambahan item bebas)\nstoreId, dateSo, rakSo, typeSo, data[], stTipe, idCashier, menu=\"entry_kkso\", clientDate, menuList, nikKkso.\ndata[]: plu, descp, conv1, conv2, subdept, barcode, tag, qty, avg_cost; f_non_plano=1 pada cabang tertentu.\n\nC. entry_kkso/save_entry_kkso dan save_per_item\nkodeToko, dateSo, rakSo, data[].\ndata[]: plu, descp, conv1, conv2, subdept, barcode, tag, qty, avg_cost.\nKode aplikasi menyerialisasi beberapa angka sebagai string; pertahankan tipe dari alur aplikasi yang dipakai.\n\nD. Contoh body check_entry/save_check_entry (ilustrasi, tidak dikirim)\n{\"kodeToko\":\"M604\",\"dateSo\":\"03-10-2026\",\"rakList\":[\"AU5\"]}\n\nE. Contoh URL jadwal vs SO (ilustrasi)\nhttps://app.alfastore.co.id/prd/api/rpt/laporan_so/jadwal_so_vs_sudah_so?storeId=M604&dateSo=03-10-2026\n\nF. Contoh URL cek PLU/barcode (placeholder sesi masih perlu diisi)\nhttps://app.alfastore.co.id/prd/api/so/cetak_kkso/cek_plu_rak_bebas?storeId=M604&dateSo=03-10-2026&rakSo=AU5&pluBarcode=454318&menuList={menuList}&lang={lang}&deviceType=pda&userSo={userSo}\n\n";

const UPSTREAM_HEADERS = [
  "App-Name", "Version-App", "Version-Code", "User-Agent", "App-Uid", "User-Id",
  "Store-Id", "Store-Id-Ext", "Shard-Id", "Ip-Addr", "Sn", "Api-Key", "AndroidId",
  "Branch-Id", "Class-Store", "Company-Id", "Company-Ext", "Platform", "Mac-Addr",
  "Authorization", "Cookie",
];

class ProxyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(data), { status, headers });
}
function authenticate(req: Request): void {
  const expected = process.env.SO_PROXY_TOKEN;
  if (!expected) return;
  const authorization = req.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ProxyError(401, "Token proxy tidak valid.");
  }
}
function upstreamHeaders(req: Request): Headers {
  const headers = new Headers({ "App-Name": "SO-PDA", Platform: "ANDROID", Accept: "*/*" });
  for (const name of UPSTREAM_HEADERS) {
    if (name === "Authorization" || name === "Cookie") continue;
    const value = req.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const raw = process.env.SO_UPSTREAM_HEADERS_JSON;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      for (const [key, value] of Object.entries(parsed)) {
        const allowed = UPSTREAM_HEADERS.find(h => h.toLowerCase() === key.toLowerCase());
        if (!allowed || typeof value !== "string") throw new Error();
        headers.set(allowed, value);
      }
    } catch {
      throw new ProxyError(503, "SO_UPSTREAM_HEADERS_JSON tidak valid; gunakan objek header string sesuai daftar dalam file.");
    }
  }
  if (process.env.SO_API_KEY) headers.set("Api-Key", process.env.SO_API_KEY);
  return headers;
}
async function readBody(req: Request): Promise<string> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ProxyError(415, "Gunakan Content-Type: application/json.");
  }
  if (!req.body) throw new ProxyError(400, "Body JSON diperlukan.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new ProxyError(413, "Body melebihi 2 MiB. Kirim batch lebih kecil.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
  } catch { throw new ProxyError(400, "Body harus berupa objek JSON yang valid."); }
  return raw;
}
async function handle(req: Request): Promise<Response> {
  try {
    authenticate(req);
    const incoming = new URL(req.url);
    if (incoming.searchParams.getAll("action").length !== 1) {
      throw new ProxyError(400, "Berikan satu parameter action; gunakan action=list untuk daftar.");
    }
    const action = incoming.searchParams.get("action")!;
    if (action === "list") {
      if (req.method !== "GET") return json({ error: "Gunakan GET." }, 405, { Allow: "GET" });
      return json({ count: ENDPOINTS.length, baseURL: BASE, endpoints: ENDPOINTS, payloadReference: PAYLOAD_REFERENCE });
    }
    const exact = ENDPOINTS.find(e => e.action === action);
    const matches = exact ? [exact] : ENDPOINTS.filter(e => e.action.split("/").pop() === action);
    if (matches.length === 0) throw new ProxyError(404, "Action tidak ditemukan. Gunakan action=list.");
    if (matches.length > 1) return json({ error: "Action ambigu; gunakan path lengkap.", actions: matches.map(e => e.action) }, 400);
    const endpoint = matches[0];
    if (req.method !== endpoint.method) {
      return json({ error: `Endpoint ini menggunakan ${endpoint.method}.` }, 405, { Allow: endpoint.method });
    }
    // Hanya URL dari katalog tetap yang dapat dituju; pengguna tidak dapat mengatur host/path.
    const url = new URL(BASE + endpoint.path);
    for (const [key, value] of incoming.searchParams) {
      if (key === "action") continue;
      if (!endpoint.query.includes(key)) throw new ProxyError(400, `Parameter query tidak dikenal: ${key}`);
      if (incoming.searchParams.getAll(key).length !== 1) throw new ProxyError(400, `Parameter ganda: ${key}`);
      url.searchParams.set(key, value);
    }
    for (const [key, value] of Object.entries(endpoint.defaults)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    // APK tidak mendokumentasikan kewajiban semua field server. Hanya identitas dasar
    // pada URL divalidasi di sini; validasi bisnis lainnya tetap milik upstream.
    for (const key of ["storeId", "kodeToko", "dateSo"]) {
      if (endpoint.query.includes(key) && !url.searchParams.get(key)?.trim()) {
        throw new ProxyError(400, `Parameter ${key} diperlukan.`);
      }
    }
    const headers = upstreamHeaders(req);
    const body = req.method === "GET" ? undefined : await readBody(req);
    if (body !== undefined) headers.set("Content-Type", "application/json; charset=utf-8");
    const configured = Number(process.env.SO_TIMEOUT_MS ?? 25000);
    const timeout = Number.isFinite(configured) ? Math.min(55000, Math.max(1000, configured)) : 25000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const abort = () => controller.abort();
    req.signal.addEventListener("abort", abort, { once: true });
    if (req.signal.aborted) controller.abort();
    try {
      const upstream = await fetch(url, {
        method: endpoint.method, headers, body, cache: "no-store",
        redirect: "manual", signal: controller.signal,
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel();
        throw new ProxyError(502, "Server upstream mengembalikan redirect; periksa sesi/konfigurasi header.");
      }
      const bytes = await upstream.arrayBuffer();
      const responseHeaders = new Headers({
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        // Laporan HTML tetap tampil; skrip dari upstream tidak berjalan pada origin proxy.
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;",
      });
      for (const key of ["content-type", "content-disposition", "retry-after"]) {
        const value = upstream.headers.get(key);
        if (value) responseHeaders.set(key, value);
      }
      if (!responseHeaders.has("content-type")) responseHeaders.set("Content-Type", "application/octet-stream");
      return new Response([204, 205, 304].includes(upstream.status) ? null : bytes, {
        status: upstream.status, headers: responseHeaders,
      });
    } catch (error) {
      if (error instanceof ProxyError) throw error;
      if (controller.signal.aborted) throw new ProxyError(504, "Request terputus atau timeout. Untuk operasi simpan, cek status data sebelum mengulang.");
      throw new ProxyError(502, "Tidak dapat menghubungi server upstream. Untuk operasi simpan, cek status data sebelum mengulang.");
    } finally {
      clearTimeout(timer);
      req.signal.removeEventListener("abort", abort);
    }
  } catch (error) {
    if (error instanceof ProxyError) return json({ error: error.message }, error.status);
    return json({ error: "Terjadi kesalahan internal pada proxy." }, 500);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
// Jangan meneruskan HEAD otomatis sebagai GET; sebagian GET APK punya efek perubahan.
export async function HEAD(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: "GET, POST, PUT, DELETE", "Cache-Control": "no-store" } });
}
