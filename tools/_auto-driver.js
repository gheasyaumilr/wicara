/* tools/_auto-driver.js - pemeriksa alur otomatis (mode anak 2 tahun).
 *
 * Dua hal yang diperiksa di sini tidak diperiksa di tempat lain:
 *
 * 1. Latihan benar-benar berjalan sendiri. Tidak ada satu pun tombol yang
 *    ditekan setelah "Mulai", tetapi mikrofon tetap terbuka dan respons
 *    tetap tercatat.
 *
 * 2. Mikrofon tidak pernah terbuka selagi audio diputar. Ini bukan detail
 *    teknis: kalau mikrofon terbuka saat speaker berbunyi, pengenal suara
 *    akan mendengar suara aplikasi sendiri dan mencatatnya sebagai jawaban
 *    benar. Seluruh angka sesi jadi tidak berarti. Pembuktiannya memakai
 *    riwayat fase dari auto.js, dan jeda pertama diperiksa dengan nilai
 *    konfigurasi yang sebenarnya (bukan nilai yang dipercepat).
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
  var tungguMs = H.tungguMs;
  var barisLog = H.barisLog;

  var kasus = window.__kasusUji || 'normal';
  var A = window.App;
  var Auto = window.Auto;
  var CFG = window.APP_CONFIG.auto;
  var N = window.EXERCISES.length;
  var KATA = window.EXERCISES.map(function (e) { return e.display; });

  /* Nilai asli sebelum dipercepat. Inilah yang harus dibuktikan diterapkan. */
  var JEDA_ASLI = CFG.listenDelayMs;
  /* Timer browser tidak pernah tepat; yang penting jedanya ada, bukan 0. */
  var TOLERANSI = 60;

  /* Satu percobaan awal, lalu maxUndang kali diundang. Angka ini dipakai untuk
     menghitung berapa catatan yang seharusnya muncul kalau anak tidak pernah
     bersuara - jangan dikunci ke angka 3, karena maxUndang bisa disetel. */
  var MAKS_PERCOBAAN = 1 + (CFG.maxUndang || 2);

  var HARAPAN = {
    normal: { selesaiSendiri: true, entri: N, catatan: null, nada: true },
    tanpaTts: { selesaiSendiri: true, entri: N, catatan: 'SpeechSynthesis tidak tersedia. Instruksi audio dilewati.', nada: true },
    tanpaStt: { selesaiSendiri: false, entri: 0, catatan: 'SpeechRecognition tidak didukung browser ini.', nada: false },
    sttJaringan: { selesaiSendiri: false, entri: 0, catatan: 'Pengenalan suara butuh koneksi internet.', nada: false },
    /* Anak diam: setiap kata dicoba MAKS_PERCOBAAN kali, semuanya NO_RESPONSE,
       lalu latihan TETAP lanjut ke kata berikutnya sampai selesai. Ini yang
       membedakan "anak tidak bersuara" dari "alat rusak". */
    diam: { selesaiSendiri: true, entri: N * MAKS_PERCOBAAN, catatan: null, nada: true }
  };

  function adaFase(nama) {
    return Auto.state.riwayat.some(function (r) { return r.fase === nama && r.selesai !== null; });
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

    /* ------------------------------------------------- A. keadaan awal */
    baris.push('');
    baris.push('--- A. keadaan awal (mode bawaan) ---');
    cek('mode bawaan adalah otomatis', A.state.mode === 'auto', A.state.mode);
    cek('tombol besar anak disembunyikan', $('actions').hidden === true);
    cek('kendali otomatis ditampilkan', $('autoBar').hidden === false);
    cek('tombol Mulai tersedia', $('btnAutoStart').hidden === false);
    cek('tombol Jeda belum muncul', $('btnAutoPause').hidden === true);
    cek('tombol Berhenti belum muncul', $('btnAutoStop').hidden === true);
    cek('indikator dengar padam', $('listenDot').hidden === true);
    cek('alur belum berjalan', Auto.state.running === false);
    cek('kata pertama ' + KATA[0], teks('targetWord') === KATA[0], teks('targetWord'));
    cek('status menyuruh menekan Mulai', /mulai/i.test(teks('status')), teks('status'));

    /* ------------------------------------ B. putaran pertama jalan sendiri */
    baris.push('');
    baris.push('--- B. satu putaran tanpa satu pun klik tambahan ---');
    var dengarSebelum = window.__stub.sttStartCount;
    /* Diambil sebelum alur dimulai. Kalau diambil setelah mikrofon terbuka,
       nada respons pertama sudah berbunyi dan pemeriksaannya jadi menunggu
       nada putaran berikutnya. */
    var nadaSebelum = window.__stub.nada.length;
    $('btnAutoStart').click();
    await wait(50);
    cek('alur berjalan', Auto.state.running === true);
    cek('tombol Jeda dan Berhenti muncul',
      $('btnAutoPause').hidden === false && $('btnAutoStop').hidden === false);

    var dengarTerjadi = await tungguMs(function () { return adaFase('dengar'); }, 2500);
    if (kasus === 'tanpaStt') {
      /* Pengenalnya memang tidak ada di browser ini. Yang benar adalah alur
         tidak memaksanya start, sehingga tidak ada catatan respons palsu. */
      cek('pengenal suara tidak dipaksa start saat tidak didukung',
        window.__stub.sttStartCount === dengarSebelum,
        'penghitung start ' + dengarSebelum + ' -> ' + window.__stub.sttStartCount);
    } else {
      /* Termasuk sttJaringan: pengenalnya ada dan memang dibuka, lalu gagal
         karena jaringan. Mikrofon tetap harus terbuka - kalau tidak, alur
         otomatis tidak pernah tahu alatnya bermasalah. */
      cek('mikrofon terbuka sendiri', dengarTerjadi && window.__stub.sttStartCount > dengarSebelum,
        'penghitung start ' + dengarSebelum + ' -> ' + window.__stub.sttStartCount);
    }

    if (kasus === 'tanpaTts') {
      cek('tidak ada audio saat TTS tidak tersedia', window.__stub.spoken.length === 0,
        window.__stub.spoken.join(' | ') || '0 ucapan');
    } else {
      cek('audio dibacakan tanpa klik', window.__stub.spoken.length >= 2, window.__stub.spoken.join(' | '));
    }

    /* Inti janji anti-gema, diukur dengan nilai konfigurasi yang sebenarnya. */
    var jeda = Auto.jedaTerakhirMs();
    cek('ada jeda antara audio berhenti dan mikrofon dibuka', jeda !== null && jeda > 0, String(jeda) + ' ms');
    cek('jeda memakai nilai konfigurasi (' + JEDA_ASLI + ' ms)',
      jeda !== null && jeda >= JEDA_ASLI - TOLERANSI, String(jeda) + ' ms');
    cek('tidak ada fase dengar yang beririsan dengan fase bicara', Auto.tanpaTumpangTindih() === true);

    var entriPertama = await tungguMs(function () { return barisLog() > 0; }, 2500);
    if (harap.entri > 0) {
      cek('respons tercatat tanpa klik', entriPertama, 'baris log ' + barisLog());
      var catatan1 = A.state.session.entries[0];
      cek('catatan ditandai berasal dari alur otomatis',
        !!catatan1 && catatan1.source === 'auto', catatan1 ? catatan1.source : '-');
      cek('catatan alur otomatis punya kolom pengukuran',
        !!catatan1 && 'durationMs' in catatan1 && 'promptLevel' in catatan1 && 'responseType' in catatan1);
    } else {
      cek('tidak ada catatan respons saat alat gagal', barisLog() === 0, String(barisLog()));
    }

    if (harap.nada) {
      await tungguMs(function () { return window.__stub.nada.length > nadaSebelum; }, 2500);
      cek('nada respons diminta', window.__stub.nada.length > nadaSebelum,
        String(window.__stub.nada.length - nadaSebelum) + ' nada');
      /* Kasus anak diam berbunyi lebih dulu: yang pertama terdengar adalah
         nada UNDANGAN, bukan nada respons. Membedakan keduanya penting -
         kalau tertukar, aplikasi akan terdengar seperti memuji anak yang
         belum menjawab apa pun. */
      var nadaDiharapkan = kasus === 'diam' ? CFG.undangTone.notes[0] : CFG.rewardTone.notes[0];
      var nadaPertama = window.__stub.nada.length > nadaSebelum
        ? window.__stub.nada[nadaSebelum].freq : null;
      cek('nada pertama sesuai jalurnya (' + nadaDiharapkan + ' Hz)',
        nadaPertama === nadaDiharapkan, String(nadaPertama));
    } else {
      cek('tidak ada nada respons saat alat gagal', window.__stub.nada.length === nadaSebelum,
        String(window.__stub.nada.length));
    }

    /* ------------------------------- C. jeda aman pada seluruh putaran */
    baris.push('');
    baris.push('--- C. jeda aman di seluruh putaran ---');
    if (harap.entri > 0) {
      await tungguMs(function () {
        return Auto.state.riwayat.filter(function (r) { return r.fase === 'dengar'; }).length >= 2 ||
          Auto.state.running === false;
      }, 6000);
    } else {
      /* Alat gagal: perilaku yang benar adalah alur berhenti sendiri setelah
         gagal berulang, bukan berputar terus tanpa satu pun data terkumpul. */
      var berhentiSendiri = await tungguMs(function () { return Auto.state.running === false; }, 12000);
      cek('alur berhenti sendiri setelah gagal berulang', berhentiSendiri, 'fase ' + Auto.state.phase);
      cek('berhenti karena alat, bukan selesai normal', Auto.state.phase === 'alat-bermasalah', Auto.state.phase);
    }
    var jedaMin = Auto.jedaMinimalMs();
    cek('setiap putaran memakai jeda aman', jedaMin !== null && jedaMin >= JEDA_ASLI - TOLERANSI,
      'terpendek ' + String(jedaMin) + ' ms');
    cek('tidak ada tumpang tindih sejauh ini', Auto.tanpaTumpangTindih() === true);
    baris.push('riwayat fase: ' + Auto.state.riwayat.map(function (r) { return r.fase; }).join(' > '));

    /* --------------------- C2. anak diam: diundang, bukan ditinggalkan */
    if (kasus === 'diam') {
      baris.push('');
      baris.push('--- C2. anak diam diundang lagi ---');
      /* Bagian C tadi berhenti begitu dua fase 'dengar' selesai, jadi
         percobaan terakhir untuk kata pertama masih berjalan. Tunggu sampai
         seluruh percobaan kata pertama benar-benar tercatat - kalau tidak,
         yang diperiksa adalah keadaan setengah jalan dan hasilnya menyesatkan. */
      await tungguMs(function () { return A.state.session.entries.length >= MAKS_PERCOBAAN; }, 12000);
      var riwayat = Auto.state.riwayat;
      cek('ada fase undang', riwayat.some(function (r) { return r.fase === 'undang' && r.selesai !== null; }));
      cek('kata diulang saat mengundang', window.__stub.spoken.length > 2,
        window.__stub.spoken.join(' | '));

      /* Tingkat bantuan harus menaik. Inilah yang membedakan anak yang mandiri
         dari anak yang perlu diundang - dan itu inti pengukuran di usia 2 tahun. */
      var tigaPertama = A.state.session.entries.slice(0, MAKS_PERCOBAAN);
      var tingkat = tigaPertama.map(function (e) { return e.promptLevel; }).join(',');
      cek('tingkat bantuan menaik P0,P1,P2', tingkat === 'P0,P1,P2', tingkat);
      cek('setiap percobaan diam tercatat NO_RESPONSE',
        tigaPertama.every(function (e) { return e.evaluation === 'NO_RESPONSE'; }),
        tigaPertama.map(function (e) { return e.evaluation; }).join(','));
      cek('jenis respons tercatat NO_RESPONSE',
        tigaPertama.every(function (e) { return e.responseType === 'NO_RESPONSE'; }),
        tigaPertama.map(function (e) { return e.responseType; }).join(','));
      cek('anak diam TIDAK dihitung sebagai kegagalan alat',
        Auto.state.phase !== 'alat-bermasalah' && Auto.state.running === true,
        'fase ' + Auto.state.phase);

      /* Yang paling penting: mengundang menambah fase ber-audio, jadi janji
         anti-gema mendapat lebih banyak kesempatan untuk bocor. */
      cek('mikrofon tetap tidak terbuka selama nada undangan', Auto.tanpaTumpangTindih() === true);
      cek('jeda aman tetap dipakai pada percobaan ulang',
        Auto.jedaMinimalMs() !== null && Auto.jedaMinimalMs() >= JEDA_ASLI - TOLERANSI,
        'terpendek ' + String(Auto.jedaMinimalMs()) + ' ms');
    }

    /* --------------------------------------------- D. jeda dan lanjutkan */
    baris.push('');
    baris.push('--- D. Jeda dan Lanjutkan ---');
    if (Auto.state.running === false) {
      /* Pada kasus alat gagal alur sudah berhenti sendiri di bagian C.
         Jeda hanya bermakna kalau alurnya memang sedang berjalan, jadi
         alur dijalankan ulang lebih dulu. */
      $('btnRestart').click();
      await wait(120);
      $('btnAutoStart').click();
      await tungguMs(function () {
        return Auto.state.phase === 'dengar' || Auto.state.phase === 'respons';
      }, 5000);
    }
    $('btnAutoPause').click();
    await wait(80);
    cek('jeda menandai alur berhenti sementara', Auto.state.paused === true && Auto.state.running === true);
    cek('tombol berubah menjadi Lanjutkan', $('btnAutoPause').textContent === 'Lanjutkan', $('btnAutoPause').textContent);
    cek('status menjelaskan jeda', /jeda/i.test(teks('status')), teks('status'));
    cek('mikrofon tidak sedang terbuka saat dijeda', Auto.state.phase !== 'dengar', Auto.state.phase);
    cek('indikator dengar padam saat dijeda', $('listenDot').hidden === true);

    var riwayatSaatJeda = Auto.state.riwayat.length;
    await wait(600);
    cek('tidak ada fase baru selama dijeda', Auto.state.riwayat.length === riwayatSaatJeda,
      riwayatSaatJeda + ' -> ' + Auto.state.riwayat.length);

    $('btnAutoPause').click();
    await wait(80);
    cek('Lanjutkan menyalakan alur lagi', Auto.state.paused === false && Auto.state.running === true);
    cek('tombol kembali menjadi Jeda', $('btnAutoPause').textContent === 'Jeda', $('btnAutoPause').textContent);

    /* -------------------------------------------------------- E. berhenti */
    baris.push('');
    baris.push('--- E. Berhenti ---');
    $('btnAutoStop').click();
    await wait(100);
    cek('Berhenti mematikan alur', Auto.state.running === false);
    cek('tombol Mulai muncul kembali', $('btnAutoStart').hidden === false);
    cek('tombol Jeda dan Berhenti disembunyikan',
      $('btnAutoPause').hidden === true && $('btnAutoStop').hidden === true);
    cek('status menjelaskan latihan dihentikan', /dihentikan|mulai/i.test(teks('status')), teks('status'));
    cek('indikator dengar padam', $('listenDot').hidden === true);

    /* --------------------------- F. jalankan sampai selesai (dipercepat) */
    baris.push('');
    baris.push('--- F. jalankan sampai keadaan akhir ---');
    /* Jeda dipercepat supaya pengujian tidak berjalan berlarut-larut.
       Janji anti-gema sudah dibuktikan dengan nilai asli di bagian B dan C. */
    window.APP_CONFIG.pauseBetweenPromptsMs = 20;
    CFG.listenDelayMs = 60;
    CFG.rewardDelayMs = 30;
    CFG.rewardMs = 80;
    CFG.gapMs = 60;

    $('btnRestart').click();
    await wait(150);
    cek('mulai ulang mengosongkan catatan', barisLog() === 0, String(barisLog()));

    var nadaSebelumAkhir = window.__stub.nada.length;
    $('btnAutoStart').click();
    var berakhir = await tungguSampai(function () { return Auto.state.running === false; }, 900);
    cek('alur berakhir sendiri tanpa klik', berakhir, 'fase akhir ' + Auto.state.phase);
    cek('tidak ada tumpang tindih sepanjang sesi', Auto.tanpaTumpangTindih() === true);
    baris.push('fase akhir: ' + Auto.state.phase + ' | siklus: ' + Auto.state.siklus +
      ' | baris log: ' + barisLog() + ' | status: ' + teks('status'));

    if (harap.selesaiSendiri) {
      cek('ringkasan sesi muncul', $('cardSummary').hidden === false);
      cek('kartu latihan disembunyikan', $('cardExercise').hidden === true);
      var ringkas = teks('summaryBody');
      cek('ringkasan menampilkan ' + N + ' / ' + N + ' latihan',
        ringkas.indexOf(N + ' / ' + N) >= 0, ringkas);
      cek('catatan respons berisi ' + harap.entri + ' baris', barisLog() === harap.entri, String(barisLog()));
      cek('setiap catatan berasal dari alur otomatis',
        A.state.session.entries.every(function (e) { return e.source === 'auto'; }));
      cek('nada penutup diminta', window.__stub.nada.length > nadaSebelumAkhir,
        String(window.__stub.nada.length - nadaSebelumAkhir) + ' nada');
    } else {
      cek('alur berhenti karena alat, bukan diam', Auto.state.phase === 'alat-bermasalah', Auto.state.phase);
      cek('status meminta orang tua memeriksa mikrofon',
        /mikrofon|izin|koneksi/i.test(teks('status')), teks('status'));
      cek('tidak ada catatan respons yang dibuat', barisLog() === 0, String(barisLog()));
      cek('ringkasan tidak dibuka', $('cardSummary').hidden === true);
      cek('tombol Mulai tersedia untuk mencoba lagi', $('btnAutoStart').hidden === false);
    }

    if (harap.catatan) {
      cek('panel orang tua mencatat masalah teknis',
        teks('parentTechnical').indexOf(harap.catatan) >= 0, teks('parentTechnical'));
    }

    /* ------------------------------------------------------------ G. ekspor */
    baris.push('');
    baris.push('--- G. ekspor sesi ---');
    var tertangkap = null;
    var BlobAsli = window.Blob;
    window.Blob = function (parts, opsi) {
      if (parts && typeof parts[0] === 'string' && parts[0].indexOf('wicara-phase0') >= 0) {
        tertangkap = parts[0];
      }
      return new BlobAsli(parts, opsi);
    };
    $('btnExport').click();
    await tungguSampai(function () { return tertangkap !== null; }, 120);
    window.Blob = BlobAsli;

    cek('berkas ekspor terbentuk', tertangkap !== null);
    if (tertangkap) {
      var data = null;
      try { data = JSON.parse(tertangkap); } catch (e) { data = null; }
      cek('ekspor berupa JSON sah', data !== null);
      if (data) {
        var entri = (data.session && data.session.entries) || [];
        cek('ekspor memuat ' + harap.entri + ' catatan', entri.length === harap.entri, String(entri.length));
        cek('ekspor mencatat mode otomatis', data.mode === 'auto', String(data.mode));
        cek('ekspor mencatat masalah teknis',
          Array.isArray(data.technical), Array.isArray(data.technical) ? data.technical.length + ' catatan' : typeof data.technical);
        cek('ekspor mencatat ambang 0.6',
          !!(data.config && data.config.partialThreshold === 0.6), data.config ? String(data.config.partialThreshold) : '-');
      }
    }

    /* ------------------------------------- H. panel orang tua tetap lengkap */
    baris.push('');
    baris.push('--- H. panel orang tua ---');
    $('btnParent').click();
    await wait(60);
    cek('panel orang tua bisa dibuka', $('parentPanel').hidden === false);
    cek('pemilih mode menunjuk mode otomatis', $('parentMode').value === 'auto', $('parentMode').value);

    var barisSebelumManual = barisLog();
    /* Dinilai terhadap kata yang sedang tampil, bukan kata pertama. Setelah
       sesi selesai, layar masih menampilkan kata terakhir. */
    var targetSekarang = A.current().target;
    $('parentManualText').value = targetSekarang;
    $('btnManualEval').click();
    var masuk = await tungguSampai(function () { return barisLog() > barisSebelumManual; }, 80);
    cek('masukan manual tetap bisa dipakai', masuk, 'baris log tetap ' + barisSebelumManual);
    cek('masukan manual dinilai tepat', teks('feedbackText') === 'Bagus!', teks('feedbackText'));
    cek('catatan manual ditandai sumbernya',
      A.state.session.entries[A.state.session.entries.length - 1].source === 'manual',
      A.state.session.entries[A.state.session.entries.length - 1].source);

    /* ------------------------------------------- I. berpindah ke mode tombol */
    baris.push('');
    baris.push('--- I. berpindah ke mode tombol ---');
    $('parentMode').value = 'tombol';
    $('parentMode').dispatchEvent(new Event('change'));
    await wait(80);
    cek('mode berubah menjadi tombol', A.state.mode === 'tombol', A.state.mode);
    cek('tombol besar anak muncul', $('actions').hidden === false);
    cek('kendali otomatis disembunyikan', $('autoBar').hidden === true);
    cek('alur otomatis berhenti saat mode berpindah', Auto.state.running === false);
    cek('catatan teknis tidak hilang karena pindah mode',
      teks('parentTechnical').length > 0, teks('parentTechnical'));
  }

  /* Alur ini memang panjang, jadi batas pengawasnya lebih longgar. */
  H.jalankan('AUTO_CHECK', jalankan, 150000);
})();
