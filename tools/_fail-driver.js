/* tools/_fail-driver.js - pemeriksa jalur kegagalan.
 *
 * PRD Prinsip 7 ("Fail Gracefully") dan US-018 mewajibkan aplikasi tetap
 * bisa dipakai kalau pengenalan suara tidak ada, izin ditolak, audio tidak
 * tersedia, gambar gagal dimuat, atau jaringan mati - dan anak tidak pernah
 * melihat pesan teknis. Berkas ini menguji janji itu.
 *
 * Dipanggil oleh fail-check.js, satu kali per kasus, dengan
 * window.__kasusUji sudah diisi.
 */
(function () {
  'use strict';

  var H = window.__harness;
  var cek = H.cek;
  var $ = H.$;
  var teks = H.teks;
  var wait = H.wait;
  var tungguSampai = H.tungguSampai;
  var barisLog = H.barisLog;
  var aktif = H.aktif;
  var dengarkan = H.dengarkan;
  var baris = H.baris;

  var kasus = window.__kasusUji || '(tidak ada)';
  var N = window.EXERCISES.length;
  var KATA1 = window.EXERCISES[0].display;
  var TARGET1 = window.EXERCISES[0].target;

  /* Apa yang diharapkan dari tiap kasus:
       sttBerfungsi - apakah tombol "Saya coba" tetap menghasilkan catatan
       catatan      - potongan teks yang wajib muncul di panel orang tua
       peringatan   - apakah banner peringatan lingkungan wajib tampil
       netPill      - teks pil jaringan yang diharapkan                  */
  var HARAPAN = {
    tanpaStt: {
      sttBerfungsi: false, peringatan: true, netPill: 'online',
      catatan: 'SpeechRecognition tidak didukung browser ini.'
    },
    sttDitolak: {
      sttBerfungsi: false, peringatan: false, netPill: 'online',
      catatan: 'Izin microphone ditolak.'
    },
    sttJaringan: {
      sttBerfungsi: false, peringatan: false, netPill: 'online',
      catatan: 'Pengenalan suara butuh koneksi internet.'
    },
    tanpaTts: {
      sttBerfungsi: true, peringatan: false, netPill: 'online',
      catatan: 'SpeechSynthesis tidak tersedia. Instruksi audio dilewati.'
    },
    gambarHilang: {
      sttBerfungsi: true, peringatan: false, netPill: 'online',
      catatan: 'gagal dimuat.'
    },
    offline: {
      sttBerfungsi: true, peringatan: false, netPill: 'offline',
      catatan: null
    }
  };

  /* Kata-kata yang tidak boleh pernah muncul di teks yang dibaca anak. */
  var TEKNIS = /typeerror|undefined|null|nan|exception|speechrecognition|speechsynthesis|getusermedia|not-allowed|uncaught|stack|trace|http|json/i;
  /* Kata yang tidak boleh dipakai untuk menyalahkan anak. */
  var MENYALAHKAN = /salah|gagal/i;

  async function cobaLatihan() {
    var sebelum = barisLog();
    $('btnSpeak').click();
    var berhenti = await tungguSampai(function () {
      return barisLog() > sebelum || $('btnNext').hidden === false;
    }, 240);
    await wait(80);
    return { berhenti: berhenti, tercatat: barisLog() > sebelum };
  }

  async function tangkapEkspor() {
    var tertangkap = null;
    var BlobAsli = window.Blob;
    window.Blob = function (parts, opsi) {
      if (parts && typeof parts[0] === 'string' && parts[0].indexOf('wicara-phase0') >= 0) {
        tertangkap = parts[0];
      }
      return new BlobAsli(parts, opsi);
    };
    $('btnExport').click();
    await tungguSampai(function () { return tertangkap !== null; }, 80);
    window.Blob = BlobAsli;
    return tertangkap;
  }

  async function jalankan() {
    await tungguSampai(function () { return teks('targetWord') !== '(elemen tidak ada)'; }, 120);
    await wait(600);

    var harap = HARAPAN[kasus];

    baris.push('=== KASUS: ' + kasus + ' ===');
    baris.push('tiruan terpasang : ' + JSON.stringify(window.__stub.terpasang));
    if (window.__stub.error) baris.push('galat tiruan     : ' + window.__stub.error);

    cek('kasus dikenal', !!harap, kasus);
    if (!harap) return;

    cek('tiruan terpasang tanpa galat', window.__stub.error === null, window.__stub.error);
    cek('semua penambalan berhasil',
      Object.keys(window.__stub.terpasang).every(function (k) { return window.__stub.terpasang[k]; }),
      JSON.stringify(window.__stub.terpasang));

    /* ------------------------------------------- A. halaman tetap hidup */
    baris.push('');
    baris.push('--- A. halaman tetap hidup ---');
    cek('kata target tetap ' + KATA1, teks('targetWord') === KATA1, teks('targetWord'));
    cek('progres tetap Latihan 1 / ' + N, teks('progressPill') === 'Latihan 1 / ' + N, teks('progressPill'));
    cek('instruksi tetap tampil',
      teks('instructionText').indexOf('Coba bilang ' + TARGET1) >= 0, teks('instructionText'));
    cek('mode tombol dipakai untuk kasus ini', window.App.state.mode === 'tombol', window.App.state.mode);
    cek('tombol Dengarkan tetap aktif', aktif('btnListen') === true);
    cek('tombol Saya coba tetap aktif', aktif('btnSpeak') === true);

    /* ------------------------------------------ B. deteksi kemampuan */
    baris.push('');
    baris.push('--- B. deteksi kemampuan ---');
    if (kasus === 'tanpaStt') {
      cek('STT terdeteksi tidak didukung', window.Mic.sttSupported === false);
      cek('banner peringatan tampil', $('envWarning').hidden === false, teks('envWarning'));
      cek('banner menyebut pengenalan suara', /pengenalan suara/i.test(teks('envWarning')), teks('envWarning'));
      cek('banner menawarkan jalan manual', /manual|orang tua/i.test(teks('envWarning')), teks('envWarning'));
    } else {
      cek('STT tetap terdeteksi didukung', window.Mic.sttSupported === true);
    }

    if (kasus === 'tanpaTts') {
      cek('TTS terdeteksi tidak didukung', window.TTS.supported === false);
      cek('tidak ada banner peringatan', $('envWarning').hidden === true, teks('envWarning'));
    } else {
      cek('TTS tetap terdeteksi didukung', window.TTS.supported === true);
    }

    if (kasus === 'gambarHilang') {
      cek('gambar latihan pertama diarahkan ke berkas tidak ada',
        String($('stimulusImage').src).indexOf('tidak-ada.svg') >= 0, $('stimulusImage').src);
      var disembunyikan = await tungguSampai(function () { return $('stimulusImage').hidden === true; }, 160);
      cek('gambar yang gagal dimuat disembunyikan', disembunyikan, 'hidden=' + $('stimulusImage').hidden);
      cek('bingkai diberi penanda gambar hilang',
        $('figure').className.indexOf('figure-missing') >= 0, $('figure').className);
      cek('kata target tetap terbaca walau gambar hilang', teks('targetWord') === KATA1, teks('targetWord'));
      cek('catatan teknis menyebut gambar gagal dimuat',
        /gagal dimuat/i.test(teks('parentTechnical')), teks('parentTechnical'));
    }

    cek('pil jaringan menulis ' + harap.netPill, teks('netPill') === harap.netPill, teks('netPill'));
    if (kasus === 'offline') {
      cek('navigator.onLine false', navigator.onLine === false, String(navigator.onLine));
      cek('pil jaringan bergaya offline', $('netPill').className.indexOf('pill-offline') >= 0, $('netPill').className);
    }

    /* ------------------------------------------- C. tekan Dengarkan */
    baris.push('');
    baris.push('--- C. tekan Dengarkan ---');
    await dengarkan();
    if (kasus === 'tanpaTts') {
      cek('status menjelaskan audio tidak tersedia', /audio tidak tersedia/i.test(teks('status')), teks('status'));
      cek('status menawarkan tetap lanjut', /tetap bisa lanjut|saya coba/i.test(teks('status')), teks('status'));
      cek('catatan teknis menyebut SpeechSynthesis',
        teks('parentTechnical').indexOf('SpeechSynthesis') >= 0, teks('parentTechnical'));
    } else {
      cek('status mengarah ke tombol Saya coba', teks('status').indexOf('Saya coba') >= 0, teks('status'));
    }
    cek('anak tidak melihat pesan teknis setelah Dengarkan', !TEKNIS.test(teks('status')), teks('status'));

    /* ------------------------------------------- D. tekan Saya coba */
    baris.push('');
    baris.push('--- D. tekan Saya coba ---');
    var hasil = await cobaLatihan();
    cek('alur berhenti di keadaan yang jelas', hasil.berhenti,
      'btnNext tersembunyi=' + $('btnNext').hidden + ' baris log=' + barisLog());
    cek('respons tercatat sesuai harapan', hasil.tercatat === harap.sttBerfungsi,
      'tercatat=' + hasil.tercatat + ' harapan=' + harap.sttBerfungsi);
    /* Inti perbaikan: jalur tanpa STT dulu membuat anak terhenti karena
       tombol Lanjut tidak pernah muncul kembali. */
    cek('anak tidak terhenti - tombol Lanjut tersedia', $('btnNext').hidden === false,
      'tersembunyi=' + $('btnNext').hidden);

    var tampilAnak = teks('feedbackText') + ' ' + teks('status') + ' ' + teks('feedbackDetail');
    cek('anak tidak melihat pesan teknis', !TEKNIS.test(tampilAnak), tampilAnak);
    cek('anak tidak disalahkan', !MENYALAHKAN.test(tampilAnak), tampilAnak);

    if (harap.catatan) {
      cek('panel orang tua mencatat masalah teknis',
        teks('parentTechnical').indexOf(harap.catatan) >= 0, teks('parentTechnical'));
    } else {
      cek('panel orang tua melaporkan tidak ada masalah',
        teks('parentTechnical') === 'Tidak ada masalah teknis.', teks('parentTechnical'));
    }

    /* ------------------------------------------- E. panel orang tua */
    baris.push('');
    baris.push('--- E. panel orang tua ---');
    $('btnParent').click();
    await wait(60);
    cek('panel orang tua bisa dibuka', $('parentPanel').hidden === false);
    cek('panel menjelaskan keadaan STT', teks('parentSttState').length > 0, teks('parentSttState'));
    if (kasus === 'tanpaStt') {
      cek('panel menyarankan masukan manual', /manual/i.test(teks('parentSttState')), teks('parentSttState'));
    }
    if (!harap.sttBerfungsi) {
      cek('panel menandai STT bermasalah pada sesi ini',
        /bermasalah|tidak mendukung/i.test(teks('parentSttState')), teks('parentSttState'));
    }

    /* ---------------------------------------- F. masukan manual tetap ada */
    baris.push('');
    baris.push('--- F. masukan manual ---');
    var barisSebelumManual = barisLog();
    $('parentManualText').value = TARGET1;
    $('btnManualEval').click();
    var masuk = await tungguSampai(function () { return barisLog() > barisSebelumManual; }, 80);
    cek('masukan manual tetap bisa dipakai', masuk, 'baris log tetap ' + barisSebelumManual);
    cek('masukan manual dinilai tepat', teks('feedbackText') === 'Bagus!', teks('feedbackText'));
    cek('kolom manual dikosongkan', $('parentManualText').value === '', $('parentManualText').value);

    /* ---------------------------------------------- G. sesi bisa diekspor */
    baris.push('');
    baris.push('--- G. ekspor sesi ---');
    var tertangkap = await tangkapEkspor();
    cek('berkas ekspor terbentuk', tertangkap !== null);

    if (tertangkap) {
      var data = null;
      try { data = JSON.parse(tertangkap); } catch (e) { data = null; }
      cek('ekspor berupa JSON sah', data !== null);
      if (data) {
        var entri = (data.session && data.session.entries) || [];
        var harapanEntri = harap.sttBerfungsi ? 2 : 1;
        cek('ekspor memuat ' + harapanEntri + ' catatan', entri.length === harapanEntri, String(entri.length));
        cek('catatan terakhir berasal dari masukan manual',
          entri.length > 0 && entri[entri.length - 1].source === 'manual',
          entri.length ? String(entri[entri.length - 1].source) : '-');
        cek('ekspor mencatat kemampuan TTS sesuai kasus',
          data.capabilities.speechSynthesis === (kasus !== 'tanpaTts'),
          String(data.capabilities.speechSynthesis));
        cek('ekspor mencatat kemampuan STT sesuai kasus',
          data.capabilities.speechRecognition === (kasus !== 'tanpaStt'),
          String(data.capabilities.speechRecognition));
        cek('ekspor mencatat ambang 0.6',
          data.config.partialThreshold === 0.6, String(data.config.partialThreshold));
        cek('setiap catatan punya kolom pengukuran',
          entri.every(function (e) {
            return 'durationMs' in e && 'promptLevel' in e && 'responseType' in e && 'similarity' in e;
          }));
      }
    }
    cek('panel melaporkan hasil ekspor',
      await tungguSampai(function () { return /disalin|diunduh/i.test(teks('parentTechnical')); }, 80),
      teks('parentTechnical'));

    /* ---------------------------------------------- H. mulai ulang */
    baris.push('');
    baris.push('--- H. mulai ulang ---');
    $('btnParent').click();
    await wait(40);
    $('btnRestart').click();
    await wait(150);
    cek('mulai ulang mengembalikan ke latihan 1', teks('progressPill') === 'Latihan 1 / ' + N, teks('progressPill'));
    cek('mulai ulang mengosongkan catatan', barisLog() === 0, String(barisLog()));
    if (kasus === 'gambarHilang') {
      /* Berkas gambarnya memang tetap tidak ada setelah mulai ulang, jadi
         catatan itu wajar muncul lagi - yang penting catatan lama tidak
         menumpuk. Menuntut panel bersih di sini salah: aplikasi justru
         sedang jujur melaporkan keadaan yang masih berlaku. */
      var catatUlang = await tungguSampai(function () {
        return /gagal dimuat/i.test(teks('parentTechnical'));
      }, 200);
      cek('mulai ulang mencatat ulang gambar yang tetap hilang', catatUlang, teks('parentTechnical'));
    } else {
      cek('mulai ulang membersihkan catatan teknis',
        teks('parentTechnical') === 'Tidak ada masalah teknis.', teks('parentTechnical'));
    }
    if (kasus === 'tanpaStt') {
      cek('mulai ulang tetap mengakui STT tidak didukung',
        /tidak mendukung/i.test(teks('parentSttState')), teks('parentSttState'));
    }
  }

  H.jalankan('FAIL_CHECK', jalankan);
})();
