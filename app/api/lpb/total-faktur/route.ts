const response = await fetch(
  "https://app.alfastore.co.id/prd/api/lpb/tablet/lpb/TotalFaktur/",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",

      "App-Name": "LPB-CLOUD",
      "Version-App": "V.2025.11.25.04",
      "Version-Code": "30",

      "User-Agent":
        "Dalvik/2.1.0 (Linux; U; Android 15; Infinix X6885 Build/AP3A.240905.015.A2)",

      "User-Id": "23067884",
      "Store-Id": storeId,

      "Api-Key":
        "ivOZX9MLMKrjlL8R23uFlaryMRIvGMXG",

      "AndroidId":
        "712f8db18eeb1816",

      "Platform": "ANDROID",

      "Host":
        "app.alfastore.co.id",

      "Connection":
        "Keep-Alive",

      "Accept-Encoding":
        "gzip"
    },


    body: JSON.stringify({

      storeId: storeId,

      faktur: faktur

    }),


    cache: "no-store"
  }
);
