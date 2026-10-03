/* tools/_auto-stub.js - tiruan API browser untuk pemeriksa alur otomatis.
 *
 * Kasus dipilih lewat window.__KASUS_UJI yang disuntikkan _runner.js tepat
 * sebelum berkas ini.
 *
 * mode 'echo' dipakai supaya tiruan pengenal suara mengucapkan kembali kata
 * yang sedang tampil di layar, sehingga alur otomatis bisa berjalan sampai
 * ringkasan tanpa perlu interaksi.
 *
 * rekamBunyi dipakai supaya nada respons WebAudio bisa diperiksa. Chrome
 * headless dijalankan dengan --mute-audio, jadi bunyinya memang tidak bisa
 * didengar - yang diperiksa adalah nada itu benar-benar diminta. */
(function () {
  'use strict';

  var KASUS = {
    normal: { mode: 'echo', rekamBunyi: true },
    tanpaStt: { tanpaStt: true, mode: 'echo', rekamBunyi: true },
    sttJaringan: { sttError: 'network', mode: 'echo', rekamBunyi: true },
    tanpaTts: { tanpaTts: true, mode: 'echo', rekamBunyi: true },
    /* Anak diam: pengenal suara tidak pernah mengembalikan kata. Mode 'queue'
       dengan daftar kosong membuat tiruan memicu onend tanpa hasil, persis
       seperti browser asli yang tidak mendengar apa-apa. Alatnya sehat - yang
       tidak ada hanyalah suara anak. */
    diam: { mode: 'queue', queue: [], rekamBunyi: true }
  };

  var nama = window.__KASUS_UJI || 'normal';
  var opsi = KASUS[nama];

  if (!opsi) {
    window.__kasusUji = '(tidak dikenal: ' + nama + ')';
    window.__stub = { terpasang: {}, error: 'kasus tidak dikenal: ' + nama, sttStartCount: 0, nada: [] };
    return;
  }

  window.__kasusUji = nama;
  window.__buatTiruan(opsi);
})();
