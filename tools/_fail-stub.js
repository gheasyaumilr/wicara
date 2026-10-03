/* tools/_fail-stub.js - tiruan API browser untuk jalur kegagalan.
 *
 * Kasus dipilih lewat window.__KASUS_UJI yang disuntikkan _runner.js tepat
 * sebelum berkas ini. Daftar kasusnya ada di fail-check.js.
 *
 * Kenapa harus disuntik sebelum config.js: speech.js dan microphone.js
 * menetapkan TTS.supported / Mic.sttSupported sekali saat dimuat, jadi
 * ketiadaan API harus sudah terlihat pada saat itu. */
(function () {
  'use strict';

  /* mode 'echo' dipakai untuk kasus yang STT-nya harus tetap berhasil:
     tiruan mengucapkan kembali kata yang sedang tampil di layar. */
  var KASUS = {
    tanpaStt: { tanpaStt: true, mode: 'echo' },
    sttDitolak: { sttError: 'not-allowed', mode: 'echo' },
    sttJaringan: { sttError: 'network', mode: 'echo' },
    tanpaTts: { tanpaTts: true, mode: 'echo' },
    gambarHilang: { gambarHilang: true, mode: 'echo' },
    offline: { offline: true, mode: 'echo' }
  };

  var nama = window.__KASUS_UJI || '';
  var opsi = KASUS[nama];

  if (!opsi) {
    window.__kasusUji = '(tidak dikenal: ' + nama + ')';
    window.__stubGagal = 'kasus tidak dikenal: ' + nama;
    window.__stub = { terpasang: {}, error: window.__stubGagal, sttStartCount: 0 };
    return;
  }

  window.__kasusUji = nama;
  window.__buatTiruan(opsi);
})();
