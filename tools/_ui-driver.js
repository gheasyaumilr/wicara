/* tools/_ui-driver.js - pemeriksa alur latihan mode tombol dari awal sampai
   ringkasan. Dimuat paling akhir, setelah _harness.js.
 *
 * Seluruh angka dihitung dari window.EXERCISES, bukan ditulis mati. Jadi
 * mengganti bank kata tidak merusak pemeriksa - yang diperiksa adalah
 * alurnya, bukan daftar katanya.
 *
 * Alur tombol diuji lewat ?mode=tombol karena mode bawaan sekarang 'auto'
 * (sasaran produk adalah anak 2 tahun). Mode otomatis diperiksa terpisah
 * oleh tools/auto-check.js.
 */
(function () {
  'use strict';

  var H = window.__harness;
  var baris = H.baris;
  var cek = H.cek;
  var $ = H.$;
  var teks = H.teks;
  var wait = H.wait;
  var tungguSampai = H.tungguSampai;
  var aktif = H.aktif;
  var barisLog = H.barisLog;
  var barisPertamaLog = H.barisPertamaLog;
  var dengarkan = H.dengarkan;
  var ucapkan = H.ucapkan;
  var lanjut = H.lanjut;

  var N = window.EXERCISES.length;
  var KATA = window.EXERCISES.map(function (e) { return e.display; });

  /* Rencana jawaban per latihan. Dua latihan pertama sengaja berbeda supaya
     semua cabang penilaian terpakai. */
  function rencana(i) {
    if (i === 0) return 'tepat';
    if (i === 1) return 'hampir';
    if (i === 2) return 'kosong';
    if (i === 3) return 'manual';
    return 'tepat';
  }

  var RENCANA = [];
  for (var i = 0; i < N; i++) RENCANA.push(rencana(i));

  function hitung(jenis) {
    return RENCANA.filter(function (r) { return r === jenis; }).length;
  }

  var JUMLAH_TEPAT = hitung('tepat') + hitung('manual');
  var JUMLAH_HAMPIR = hitung('hampir');
  var JUMLAH_KOSONG = hitung('kosong');
  var AKURASI = Number(((JUMLAH_TEPAT / N) * 100).toFixed(1));

  /* Jawaban untuk tiap jenis, diturunkan dari kata sasaran. */
  function jawaban(jenis, target) {
    if (jenis === 'tepat' || jenis === 'manual') return target;
    if (jenis === 'hampir') return target.slice(0, -1);
    return '';
  }

  async function jalankan() {
    await tungguSampai(function () { return teks('targetWord') !== '(elemen tidak ada)'; }, 120);
    await wait(600);

    baris.push('=== A. KEADAAN AWAL (mode tombol, ' + N + ' kata) ===');
    baris.push('tiruan terpasang : ' + JSON.stringify(window.__stub.terpasang));
    if (window.__stub.error) baris.push('galat tiruan     : ' + window.__stub.error);

    cek('tiruan API terpasang seluruhnya',
      Object.keys(window.__stub.terpasang).every(function (k) { return window.__stub.terpasang[k]; }),
      JSON.stringify(window.__stub.terpasang));
    cek('tidak ada galat saat memasang tiruan', window.__stub.error === null, window.__stub.error);

    cek('mode tombol aktif lewat ?mode=tombol', window.App.state.mode === 'tombol', window.App.state.mode);
    cek('tombol besar ditampilkan', $('actions').hidden === false);
    cek('kendali otomatis disembunyikan', $('autoBar').hidden === true);

    cek('progres awal "Latihan 1 / ' + N + '"', teks('progressPill') === 'Latihan 1 / ' + N, teks('progressPill'));
    cek('kata target ' + KATA[0], teks('targetWord') === KATA[0], teks('targetWord'));
    cek('instruksi memuat "Coba bilang ' + window.EXERCISES[0].target + '"',
      teks('instructionText').indexOf('Coba bilang ' + window.EXERCISES[0].target) >= 0, teks('instructionText'));

    var img = $('stimulusImage');
    cek('gambar menunjuk ' + window.EXERCISES[0].image,
      !!img && String(img.src).indexOf(window.EXERCISES[0].image) >= 0, img ? img.src : '-');
    cek('gambar benar-benar tergambar', !!img && img.naturalWidth > 0, img ? String(img.naturalWidth) + ' px' : '-');
    cek('teks alternatif gambar terisi',
      !!img && String(img.alt).indexOf(window.EXERCISES[0].target) >= 0, img ? img.alt : '-');

    cek('status awal menyuruh Dengarkan', teks('status').indexOf('Dengarkan') >= 0, teks('status'));
    cek('tombol Lanjut tersembunyi', $('btnNext').hidden === true);
    cek('ringkasan tersembunyi', $('cardSummary').hidden === true);
    cek('panel orang tua tersembunyi', $('parentPanel').hidden === true);
    cek('feedback kosong', $('feedback').hidden === true);
    cek('tidak ada peringatan lingkungan', $('envWarning').hidden === true, teks('envWarning'));
    cek('STT terdeteksi didukung', window.Mic.sttSupported === true);
    cek('konteks dianggap aman', window.Mic.secureContext() === true);
    cek('tiruan menyediakan suara id-ID', window.TTS.idVoiceCount() === 1, String(window.TTS.idVoiceCount()));

    /* ------------------------------------------ latihan 1: ucapan tepat */
    baris.push('');
    baris.push('=== B. LATIHAN 1 (' + window.EXERCISES[0].target + ') - ucapan tepat ===');
    await dengarkan();
    var diucapkan = window.__stub.spoken.join(' | ');
    cek('TTS membacakan "' + window.EXERCISES[0].prompt + '"',
      diucapkan.indexOf(window.EXERCISES[0].prompt) >= 0, diucapkan || '(tidak ada yang dibacakan)');
    cek('TTS membacakan "Coba bilang ' + window.EXERCISES[0].target + '"',
      diucapkan.indexOf('Coba bilang ' + window.EXERCISES[0].target) >= 0, diucapkan);
    cek('status mengarah ke tombol Saya coba', teks('status').indexOf('Saya coba') >= 0, teks('status'));

    window.__stub.mode = 'queue';
    window.__stub.queue = [jawaban('tepat', window.EXERCISES[0].target)];
    if (await ucapkan('latihan 1 (' + window.EXERCISES[0].target + ')')) {
      cek('feedback "Bagus!"', teks('feedbackText') === 'Bagus!', teks('feedbackText'));
      cek('nada feedback positif', $('feedback').className.indexOf('feedback-good') >= 0, $('feedback').className);
      cek('feedback menampilkan apa yang terdengar',
        teks('feedbackDetail').indexOf(window.EXERCISES[0].target) >= 0, teks('feedbackDetail'));
      cek('tombol Lanjut muncul', $('btnNext').hidden === false);
      cek('catatan respons berisi 1 baris', barisLog() === 1, String(barisLog()));
      cek('baris log berisi MATCH', barisPertamaLog().indexOf('MATCH') >= 0, barisPertamaLog());
      cek('baris log berisi INDEPENDENT', barisPertamaLog().indexOf('INDEPENDENT') >= 0, barisPertamaLog());
    }
    cek('feedback tidak memakai kata terlarang',
      !/salah|gagal/i.test(teks('feedbackText') + ' ' + teks('status')),
      teks('feedbackText') + ' / ' + teks('status'));

    /* -------------------------------------- latihan 2: ucapan hampir benar */
    baris.push('');
    baris.push('=== C. LATIHAN 2 (' + window.EXERCISES[1].target + ') - hampir benar ===');
    if (await lanjut(KATA[1])) {
      cek('progres jadi 2 / ' + N, teks('progressPill') === 'Latihan 2 / ' + N, teks('progressPill'));
      cek('feedback dibersihkan saat pindah latihan', $('feedback').hidden === true);
    }

    window.__stub.queue = [jawaban('hampir', window.EXERCISES[1].target)];
    if (await ucapkan('latihan 2 (' + window.EXERCISES[1].target + ')')) {
      cek('feedback "Hampir!"', teks('feedbackText') === 'Hampir!', teks('feedbackText'));
      cek('nada feedback peringatan', $('feedback').className.indexOf('feedback-warn') >= 0, $('feedback').className);
      cek('baris log berisi PARTIAL_MATCH', barisPertamaLog().indexOf('PARTIAL_MATCH') >= 0, barisPertamaLog());
      cek('baris log berisi APPROXIMATION', barisPertamaLog().indexOf('APPROXIMATION') >= 0, barisPertamaLog());
    }

    /* ----------------------------------------- latihan 3: tanpa suara */
    baris.push('');
    baris.push('=== D. LATIHAN 3 (' + window.EXERCISES[2].target + ') - tidak ada suara ===');
    await lanjut(KATA[2]);

    window.__stub.queue = [''];
    if (await ucapkan('latihan 3 (' + window.EXERCISES[2].target + ')')) {
      cek('feedback tetap menyemangati', teks('feedbackText') === 'Ayo coba lagi', teks('feedbackText'));
      cek('feedback tidak menyebut gagal', !/gagal|salah/i.test(teks('feedbackText')), teks('feedbackText'));
      cek('baris log berisi NO_RESPONSE', barisPertamaLog().indexOf('NO_RESPONSE') >= 0, barisPertamaLog());
    }

    /* ---------------------------- latihan 4: masukan manual orang tua */
    baris.push('');
    baris.push('=== E. LATIHAN 4 (' + window.EXERCISES[3].target + ') - masukan manual ===');
    await lanjut(KATA[3]);

    var inputManual = $('parentManualText');
    cek('kolom masukan manual ada', !!inputManual);
    if (inputManual) {
      var barisSebelumManual = barisLog();
      inputManual.value = jawaban('manual', window.EXERCISES[3].target);
      $('btnManualEval').click();
      var tercatat = await tungguSampai(function () { return barisLog() > barisSebelumManual; }, 60);
      cek('masukan manual tercatat', tercatat, 'baris log tetap ' + barisSebelumManual);
      cek('masukan manual dinilai tepat', teks('feedbackText') === 'Bagus!', teks('feedbackText'));
      cek('kolom manual dikosongkan setelah dinilai', inputManual.value === '', inputManual.value);
    }

    /* ------------------------------- latihan 5..N: semua dijawab tepat */
    baris.push('');
    baris.push('=== F. LATIHAN 5-' + N + ' - semua dijawab tepat ===');
    /* Wajib maju dulu: latihan 4 baru selesai dinilai manual, jadi layar
       masih menampilkan MATA. Tanpa langkah ini loop di bawah memeriksa kata
       yang salah - dan tetap melaporkan "lulus" karena mode echo selalu
       mengembalikan kata yang sedang tampil. */
    await lanjut(KATA[4]);
    window.__stub.mode = 'echo';
    for (var i = 4; i < N; i++) {
      if (teks('targetWord') !== KATA[i]) {
        cek('urutan latihan sampai ' + KATA[i], false, 'layar menunjukkan ' + teks('targetWord'));
        break;
      }
      if (await ucapkan('latihan ' + KATA[i])) {
        cek('latihan ' + KATA[i] + ' dinilai tepat', teks('feedbackText') === 'Bagus!', teks('feedbackText'));
      }
      await lanjut(i < N - 1 ? KATA[i + 1] : null);
    }
    baris.push('setelah semua latihan: progress=' + teks('progressPill') +
      ' | target=' + teks('targetWord') +
      ' | status=' + teks('status') +
      ' | lanjut tersembunyi=' + $('btnNext').hidden);
    cek('catatan respons berisi ' + N + ' baris', barisLog() === N, String(barisLog()));

    /* ------------------------------------------------------- ringkasan */
    baris.push('');
    baris.push('=== G. RINGKASAN SESI ===');
    await tungguSampai(function () { return $('cardSummary').hidden === false; }, 80);
    cek('halaman ringkasan muncul', $('cardSummary').hidden === false);
    cek('kartu latihan disembunyikan', $('cardExercise').hidden === true);
    cek('tombol aksi disembunyikan', $('actions').hidden === true);

    var ringkas = teks('summaryBody');
    cek('menampilkan ' + N + ' / ' + N + ' latihan', ringkas.indexOf(N + ' / ' + N) >= 0, ringkas);
    cek('menampilkan ' + N + ' total percobaan', ringkas.indexOf(N + 'Total percobaan') >= 0, ringkas);
    cek('menampilkan ' + JUMLAH_TEPAT + ' tepat', ringkas.indexOf(JUMLAH_TEPAT + 'Tepat') >= 0, ringkas);
    cek('menampilkan ' + JUMLAH_HAMPIR + ' hampir', ringkas.indexOf(JUMLAH_HAMPIR + 'Hampir') >= 0, ringkas);
    cek('menampilkan ' + JUMLAH_KOSONG + ' belum sesuai',
      ringkas.indexOf(JUMLAH_KOSONG + 'Belum sesuai') >= 0, ringkas);
    cek('accuracy ' + AKURASI + '%', ringkas.indexOf(AKURASI + '%Accuracy') >= 0, ringkas);
    cek('independence ' + AKURASI + '%', ringkas.indexOf(AKURASI + '%Independence') >= 0, ringkas);
    cek('menampilkan durasi', /\d+ detikDurasi/.test(ringkas), ringkas);
    cek('ada peringatan bukan penilaian klinis', ringkas.indexOf('bukan penilaian klinis') >= 0, ringkas);

    /* ------------------------------------------------------ ekspor JSON */
    baris.push('');
    baris.push('=== H. EKSPOR HASIL ===');
    var tertangkap = null;
    var BlobAsli = window.Blob;
    window.Blob = function (parts, opsi) {
      if (parts && typeof parts[0] === 'string' && parts[0].indexOf('wicara-phase0') >= 0) {
        tertangkap = parts[0];
      }
      return new BlobAsli(parts, opsi);
    };

    $('btnExport').click();
    await tungguSampai(function () { return tertangkap !== null; }, 60);
    window.Blob = BlobAsli;

    cek('berkas ekspor terbentuk', tertangkap !== null);
    if (tertangkap) {
      var data = null;
      try { data = JSON.parse(tertangkap); } catch (e) { data = null; }
      cek('ekspor berupa JSON sah', data !== null);
      if (data) {
        var entri = (data.session && data.session.entries) || [];
        cek('ekspor memuat ' + N + ' catatan', entri.length === N, String(entri.length));
        cek('ringkasan ekspor accuracy ' + AKURASI,
          !!(data.session && data.session.summary && data.session.summary.accuracy === AKURASI),
          data.session && data.session.summary ? String(data.session.summary.accuracy) : '-');
        cek('ekspor mencatat kemampuan STT', !!(data.capabilities && data.capabilities.speechRecognition === true));
        cek('ekspor mencatat ambang 0.6', !!(data.config && data.config.partialThreshold === 0.6),
          data.config ? String(data.config.partialThreshold) : '-');
        cek('ekspor mencatat mode tombol', data.mode === 'tombol', String(data.mode));
        cek('setiap catatan punya kolom pengukuran',
          entri.every(function (e) {
            return 'durationMs' in e && 'promptLevel' in e && 'responseType' in e && 'similarity' in e;
          }));
        cek('catatan manual ditandai sumbernya',
          entri.filter(function (e) { return e.source === 'manual'; }).length === 1,
          String(entri.filter(function (e) { return e.source === 'manual'; }).length));
        cek('catatan STT ditandai sumbernya',
          entri.filter(function (e) { return e.source === 'stt'; }).length === N - 1,
          String(entri.filter(function (e) { return e.source === 'stt'; }).length));
        cek('tidak ada catatan yang mengaku dari alur otomatis',
          entri.filter(function (e) { return e.source === 'auto'; }).length === 0);
      }
    }
    cek('panel melaporkan hasil ekspor',
      await tungguSampai(function () { return /disalin|diunduh/i.test(teks('parentTechnical')); }, 80),
      teks('parentTechnical'));

    /* --------------------------------------------------- panel orang tua */
    baris.push('');
    baris.push('=== I. PANEL ORANG TUA ===');
    $('btnParent').click();
    await wait(60);
    cek('panel orang tua terbuka', $('parentPanel').hidden === false);
    cek('aria-expanded jadi true', $('btnParent').getAttribute('aria-expanded') === 'true', $('btnParent').getAttribute('aria-expanded'));
    cek('panel menampilkan keadaan STT', teks('parentSttState').length > 0, teks('parentSttState'));
    cek('pemilih mode menunjuk mode tombol', $('parentMode').value === 'tombol', $('parentMode').value);

    $('btnParent').click();
    await wait(60);
    cek('panel orang tua bisa ditutup lagi', $('parentPanel').hidden === true);

    /* ---------------------------------------------------------- mulai ulang */
    $('btnRestart').click();
    await wait(150);
    cek('mulai ulang mengembalikan ke latihan 1', teks('progressPill') === 'Latihan 1 / ' + N, teks('progressPill'));
    cek('mulai ulang mengembalikan kata ' + KATA[0], teks('targetWord') === KATA[0], teks('targetWord'));
    cek('mulai ulang mengosongkan catatan', barisLog() === 0, String(barisLog()));
    cek('mulai ulang menyembunyikan ringkasan', $('cardSummary').hidden === true);
    cek('mulai ulang memunculkan kembali kartu latihan', $('cardExercise').hidden === false);
    cek('mulai ulang tetap di mode tombol', $('actions').hidden === false && $('autoBar').hidden === true);
  }

  H.jalankan('UI_CHECK', jalankan);
})();
