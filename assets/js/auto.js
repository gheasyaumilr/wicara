/* auto.js - alur latihan otomatis untuk anak sekitar 2 tahun.
 *
 * Kenapa ada mode ini: alur tombol menuntut anak menekan Dengarkan, lalu
 * Saya coba, lalu Lanjut. Anak 24 bulan belum bisa membaca label, belum bisa
 * menyusun urutan dua langkah, dan pada usia itu memang bukan dia yang
 * seharusnya mengoperasikan aplikasi. Di mode ini orang tua menekan Mulai
 * satu kali, lalu aplikasi berjalan sendiri: tampilkan gambar, bacakan kata,
 * tunggu, buka mikrofon, nilai, beri respons, pindah kata.
 *
 * ATURAN PALING PENTING DI BERKAS INI
 * Mikrofon tidak boleh pernah terbuka selagi audio diputar. Kalau terbuka,
 * pengenal suara akan mendengar suara aplikasi sendiri dari speaker dan
 * mencatatnya sebagai jawaban benar - semua skor jadi 100% dan tidak berarti
 * apa-apa. Karena itu urutannya dipaksa: tunggu bacakanPrompt() selesai,
 * tunggu jeda listenDelayMs, baru buka mikrofon. Pemeriksa di
 * tools/auto-check.js membuktikan janji itu lewat riwayat fase di bawah.
 */
(function (global) {
  'use strict';

  var A = global.App;
  var cfg = (global.APP_CONFIG && global.APP_CONFIG.auto) || {};

  var state = {
    running: false,
    paused: false,
    token: 0,
    phase: 'idle',
    riwayat: [],
    siklus: 0,
    gagalBerturut: 0
  };

  var el = {};
  var konteks = null;

  function $(id) { return document.getElementById(id); }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Benar kalau putaran ini sudah tidak berlaku lagi: dihentikan, dijeda,
     atau digantikan putaran yang lebih baru. */
  function batal(token) { return token !== state.token || !state.running; }

  function angka(nama, bawaan) {
    var nilai = cfg[nama];
    return typeof nilai === 'number' && nilai > 0 ? nilai : bawaan;
  }

  /* ------------------------------------------------------------- riwayat */

  /* Setiap fase dicatat beserta waktu mulai dan selesainya. Ini bukan hiasan:
     pemeriksa memakainya untuk membuktikan fase 'dengar' tidak pernah
     beririsan dengan fase 'bicara'. */
  function mulaiFase(nama) {
    var catat = { fase: nama, mulai: Date.now(), selesai: null };
    state.riwayat.push(catat);
    state.phase = nama;
    return catat;
  }

  function akhiriFase(catat) {
    if (catat && catat.selesai === null) catat.selesai = Date.now();
  }

  function akhiriFaseTerbuka() {
    for (var i = state.riwayat.length - 1; i >= 0; i--) {
      if (state.riwayat[i].selesai === null) { state.riwayat[i].selesai = Date.now(); return; }
    }
  }

  /* -------------------------------------------------------------- tampilan */

  function indikatorDengar(nyala) {
    if (el.listenDot) el.listenDot.hidden = !nyala;
    if (el.figure) el.figure.classList.toggle('is-listening', !!nyala);
  }

  function perbaruiTombol() {
    if (el.btnAutoStart) el.btnAutoStart.hidden = state.running;
    if (el.btnAutoStop) el.btnAutoStop.hidden = !state.running;
    if (el.btnAutoPause) {
      el.btnAutoPause.hidden = !state.running;
      el.btnAutoPause.textContent = state.paused ? 'Lanjutkan' : 'Jeda';
    }
  }

  /* ----------------------------------------------------------------- bunyi */

  function siapkanBunyi() {
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      if (!konteks) konteks = new Ctx();
      if (konteks.state === 'suspended' && konteks.resume) konteks.resume();
    } catch (e) { /* bunyi respons tidak wajib */ }
  }

  /* Nada pendek lewat WebAudio. Sengaja bukan suara manusia: kalau respons
     memakai kata, anak bisa menirukannya dan pengukuran jadi kacau. Hanya
     dipanggil setelah mikrofon ditutup. */
  function nada(spec) {
    if (!spec || !spec.notes || !spec.notes.length) return false;
    try {
      if (!konteks) siapkanBunyi();
      if (!konteks) return false;
      var durasi = (spec.noteMs || 130) / 1000;
      spec.notes.forEach(function (freq, i) {
        var osc = konteks.createOscillator();
        var gain = konteks.createGain();
        var mulai = konteks.currentTime + i * durasi;
        var selesai = mulai + durasi;
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, mulai);
        gain.gain.linearRampToValueAtTime(spec.gain || 0.14, mulai + 0.02);
        gain.gain.linearRampToValueAtTime(0, selesai);
        osc.connect(gain);
        gain.connect(konteks.destination);
        osc.start(mulai);
        osc.stop(selesai + 0.02);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* --------------------------------------------------------------- putaran */

  /* Fase yang mengeluarkan suara dari speaker. Mikrofon tidak boleh terbuka
     selama salah satu fase ini. Yang dijaga bukan hanya kata yang dibacakan,
     tetapi juga NADA UNDANGAN - nada itu juga keluar dari speaker, jadi ia
     bisa ikut terdengar pengenal suara dan merusak penilaian dengan cara yang
     sama. Menambah fase ber-audio baru? Daftarkan di sini. */
  var FASE_AUDIO = ['bicara', 'undang'];

  function faseAudio(r) {
    return FASE_AUDIO.indexOf(r.fase) !== -1 && r.selesai !== null;
  }

  /* Satu putaran = satu kata. Mengembalikan 'lanjut', 'selesai', atau 'batal'.

     Bentuknya sengaja berupa percobaan berulang, bukan satu percobaan tunggal.
     Kalau anak belum bersuara, dia TIDAK langsung ditinggalkan: dia diundang
     lagi dengan bantuan yang lebih jelas. Yang diukur jadi bukan hanya "benar
     atau tidak", tetapi juga "berapa besar bantuan yang dibutuhkan" - dan
     itulah yang membedakan anak yang mandiri dari anak yang perlu diundang.
     Tingkat bantuannya tercatat otomatis lewat Therapy.derivePromptLevel(). */
  async function satuKata(token) {
    var ex = A.current();
    if (!ex) return 'selesai';

    A.clearFeedback();
    if (el.figure) el.figure.classList.remove('is-reward', 'is-inviting');
    indikatorDengar(false);

    var maksPercobaan = 1 + angka('maxUndang', 2);
    var kesudahan = 'diam';   /* 'menjawab' | 'diam' | 'alat' */

    for (var percobaan = 1; percobaan <= maksPercobaan; percobaan++) {
      var percobaanTerakhir = percobaan === maksPercobaan;

      /* ---- 1. Audio: bacakan kata, atau undang anak dengan bantuan yang
         lebih jelas. Mikrofon belum boleh terbuka di sepanjang bagian ini. ---- */
      if (percobaan === 1) {
        var catatBicara = mulaiFase('bicara');
        A.setStatus('Dengarkan...', 'live');
        var bicara = await A.bacakanPrompt(ex);
        akhiriFase(catatBicara);
        if (batal(token)) return 'batal';

        if (!bicara.spoken) {
          A.setStatus('Audio tidak tersedia. Orang tua yang membacakan katanya ya.', 'warn');
        }
      } else {
        /* Anak belum bersuara. Ini bukan kegagalan, jadi tidak dihitung
           sebagai kegagalan alat: dia diundang lagi. */
        var catatUndang = mulaiFase('undang');
        A.setStatus('Ayo, coba bilang ' + ex.target + '...', 'live');
        if (el.figure) el.figure.classList.add('is-inviting');
        nada(cfg.undangTone);
        await wait(angka('undangDelayMs', 800));
        akhiriFase(catatUndang);
        if (el.figure) el.figure.classList.remove('is-inviting');
        if (batal(token)) return 'batal';

        /* Kata diulang - inilah bantuan P1/P2 pada kerangka terapi
           (instruksi diulang, lalu diberi contoh). */
        var catatUlang = mulaiFase('bicara');
        if (cfg.ulangiKataSaatUndang !== false) {
          try { await A.bacakanPrompt(ex); } catch (e) { /* audio opsional */ }
        }
        akhiriFase(catatUlang);
        if (batal(token)) return 'batal';
      }

      /* ---- 2. Jeda pengaman gema. Inilah yang mencegah mikrofon mendengar
         speaker, dan sekarang berlaku untuk setiap percobaan. ---- */
      var catatJeda = mulaiFase('jeda');
      await wait(angka('listenDelayMs', 650));
      akhiriFase(catatJeda);
      if (batal(token)) return 'batal';

      /* ---- 3. Buka mikrofon dan tunggu anak. Percobaan setelah diundang
         diberi waktu lebih longgar. ---- */
      var catatDengar = mulaiFase('dengar');
      indikatorDengar(true);
      A.setStatus('Mendengarkan...', 'live');
      var hasil = await A.dengarSekali({
        timeoutMs: percobaan === 1 ? angka('listenMs', 6000) : angka('listenMsUlang', 8000),
        /* Hanya menulis status kalau memang ada kata yang terdengar sementara.
           Menulis status tanpa syarat akan menimpa pesan lain - misalnya pesan
           jeda - ketika pengenal suara mengirim peristiwa yang telat. */
        onInterim: function (teksSementara) {
          if (teksSementara) A.setStatus('Mendengarkan...', 'live');
        }
      });
      indikatorDengar(false);
      akhiriFase(catatDengar);
      if (batal(token)) return 'batal';
      if (hasil && hasil.stoppedByUser) return 'batal';

      /* ---- 4. Nilai. ---- */
      var adaSuara = !!(hasil && hasil.ok && String(hasil.transcript || '').trim());

      if (adaSuara) {
        A.catatRespons(hasil.transcript, {
          alternatives: hasil.alternatives || [],
          durationMs: hasil.durationMs || null,
          source: 'auto'
        });
        state.gagalBerturut = 0;
        kesudahan = 'menjawab';
        break;
      }

      if (hasil && !hasil.ok && hasil.error !== 'no-speech') {
        /* Kegagalan alat: sengaja tidak membuat catatan respons. Mencatatnya
           sebagai NO_RESPONSE berarti menghitung mikrofon yang rusak sebagai
           anak yang tidak mau mencoba, dan itu merusak angka accuracy. */
        state.gagalBerturut++;
        A.setStatus('Suara belum bisa direkam. Lanjut ke kata berikutnya ya.', 'warn');
        kesudahan = 'alat';
        break;
      }

      /* Anak belum bersuara. Ini NO_RESPONSE yang sah dan tetap dicatat,
         beserta tingkat bantuannya - sehingga nanti bisa dibedakan anak yang
         tidak bersuara sama sekali dari anak yang menjawab setelah diundang. */
      A.catatRespons('', {
        alternatives: [],
        durationMs: hasil ? hasil.durationMs : null,
        source: 'auto'
      });
      state.gagalBerturut = 0;
      kesudahan = 'diam';

      /* Tulisan hasil dari percobaan ini dibersihkan supaya anak tidak melihat
         "ayo coba lagi" sebagai keputusan akhir. Yang dia lihat berikutnya
         adalah ajakan, bukan penilaian. */
      if (!percobaanTerakhir) A.clearFeedback();
    }

    /* ---- 5. Respons. Mikrofon sudah tertutup di titik ini. ---- */
    var entri = A.state.session.entries[A.state.session.entries.length - 1];
    var positif = kesudahan === 'menjawab' && entri &&
      (entri.evaluation === 'MATCH' || entri.evaluation === 'PARTIAL_MATCH');

    if (positif) {
      nada(cfg.rewardTone);
      if (el.figure) el.figure.classList.add('is-reward');
    } else if (kesudahan !== 'alat') {
      /* Pelan saja. Anak 2 tahun tidak boleh merasa gagal karena belum jelas
         mengucapkan sesuatu. */
      nada(cfg.softTone);
    }

    var catatRespons = mulaiFase('respons');
    await wait(angka('rewardMs', 1400));
    if (el.figure) el.figure.classList.remove('is-reward', 'is-inviting');
    akhiriFase(catatRespons);
    if (batal(token)) return 'batal';

    /* ---- 6. Jeda lalu pindah kata. ---- */
    var catatJeda2 = mulaiFase('jeda');
    await wait(angka('gapMs', 700));
    akhiriFase(catatJeda2);
    if (batal(token)) return 'batal';

    var sebelum = A.state.index;
    A.lanjutLatihan();
    if (A.state.index === sebelum) return 'selesai';
    return 'lanjut';
  }

  async function jalan(token) {
    while (state.running && !batal(token)) {
      var hasil = await satuKata(token);
      if (hasil === 'batal') return;
      if (hasil === 'selesai') break;

      /* Kalau mikrofon gagal berulang, meneruskan sisa kata tidak ada
         gunanya - tidak akan ada satu pun data yang terkumpul. Lebih baik
         berhenti dan memberi tahu orang tua apa yang harus diperiksa. */
      if (state.gagalBerturut >= angka('maxGagalBerturut', 2)) {
        berhentiKarenaAlat();
        return;
      }

      state.siklus++;
      /* Batas aman. Loop ini tidak boleh bisa berputar tanpa henti kalau ada
         keadaan yang tidak terduga. */
      if (state.siklus > 200) break;
    }
    if (batal(token)) return;

    state.running = false;
    state.phase = 'selesai';
    perbaruiTombol();
    A.setStatus('Latihan selesai. Terima kasih sudah berlatih!', 'ready');
    nada(cfg.finishTone);
  }

  function berhentiKarenaAlat() {
    state.running = false;
    state.paused = false;
    state.phase = 'alat-bermasalah';
    perbaruiTombol();
    A.setStatus('Mikrofon belum bisa merekam. Periksa izin dan koneksi, lalu tekan "Mulai" lagi.', 'warn');
  }

  /* ------------------------------------------------------------- kendali */

  function start() {
    if (state.running) return false;
    /* Kalau sesi sebelumnya sudah sampai ringkasan, tekan Mulai berarti
       memulai sesi baru, bukan mengulang kata terakhir. */
    if (el.cardSummary && el.cardSummary.hidden === false) A.mulaiUlang();

    siapkanBunyi();
    state.running = true;
    state.paused = false;
    state.riwayat = [];
    state.siklus = 0;
    state.gagalBerturut = 0;
    state.token++;
    A.clearFeedback();
    perbaruiTombol();
    jalan(state.token);
    return true;
  }

  function pause() {
    if (!state.running || state.paused) return false;
    state.paused = true;
    state.token++;
    if (global.TTS && global.TTS.cancel) global.TTS.cancel();
    if (global.Mic && global.Mic.stop) global.Mic.stop();
    indikatorDengar(false);
    if (el.figure) el.figure.classList.remove('is-reward', 'is-inviting');
    akhiriFaseTerbuka();
    state.phase = 'jeda-manual';
    perbaruiTombol();
    A.setStatus('Jeda. Tekan "Lanjutkan" ya.', 'warn');
    return true;
  }

  function resume() {
    if (!state.running || !state.paused) return false;
    state.paused = false;
    state.token++;
    perbaruiTombol();
    jalan(state.token);
    return true;
  }

  function stop() {
    var sebelumnyaAktif = state.running;
    state.running = false;
    state.paused = false;
    state.token++;
    if (global.TTS && global.TTS.cancel) global.TTS.cancel();
    if (global.Mic && global.Mic.stop) global.Mic.stop();
    indikatorDengar(false);
    if (el.figure) el.figure.classList.remove('is-reward', 'is-inviting');
    akhiriFaseTerbuka();
    state.phase = 'berhenti';
    perbaruiTombol();
    if (sebelumnyaAktif) {
      A.setStatus('Latihan dihentikan. Tekan "Mulai" untuk mengulang.', 'warn');
    }
    return sebelumnyaAktif;
  }

  /* --------------------------------------------------------------- init */

  function init() {
    el.autoBar = $('autoBar');
    el.btnAutoStart = $('btnAutoStart');
    el.btnAutoPause = $('btnAutoPause');
    el.btnAutoStop = $('btnAutoStop');
    el.listenDot = $('listenDot');
    el.figure = $('figure');
    el.cardSummary = $('cardSummary');

    if (el.btnAutoStart) el.btnAutoStart.addEventListener('click', start);
    if (el.btnAutoPause) {
      el.btnAutoPause.addEventListener('click', function () {
        if (state.paused) resume(); else pause();
      });
    }
    if (el.btnAutoStop) el.btnAutoStop.addEventListener('click', stop);

    perbaruiTombol();
  }

  global.Auto = {
    start: start,
    pause: pause,
    resume: resume,
    stop: stop,
    state: state,

    /* Dipakai pemeriksa. */
    jedaTerakhirMs: function () {
      var audio = null;
      var dengar = null;
      for (var i = state.riwayat.length - 1; i >= 0; i--) {
        var r = state.riwayat[i];
        if (!dengar && r.fase === 'dengar' && r.selesai !== null) dengar = r;
        if (dengar && faseAudio(r)) { audio = r; break; }
      }
      if (!audio || !dengar) return null;
      return dengar.mulai - audio.selesai;
    },

    /* Jeda terpendek antara audio berhenti dan mikrofon dibuka, dihitung
       dari seluruh putaran. Pemeriksa memakai ini untuk membuktikan jeda
       pengaman gema benar-benar diterapkan pada setiap kata dan setiap
       percobaan ulang, bukan hanya pada kata pertama. */
    jedaMinimalMs: function () {
      var audio = state.riwayat.filter(faseAudio);
      var dengar = state.riwayat.filter(function (r) {
        return r.fase === 'dengar' && r.selesai !== null;
      });
      if (!audio.length || !dengar.length) return null;
      var minimum = null;
      dengar.forEach(function (d) {
        var sebelum = null;
        audio.forEach(function (b) {
          if (b.selesai <= d.mulai && (!sebelum || b.selesai > sebelum.selesai)) sebelum = b;
        });
        if (!sebelum) return;
        var jeda = d.mulai - sebelum.selesai;
        if (minimum === null || jeda < minimum) minimum = jeda;
      });
      return minimum;
    },

    /* Janji anti-gema: tidak ada fase 'dengar' yang beririsan dengan fase
       ber-audio mana pun (kata yang dibacakan maupun nada undangan). Kalau
       ini false, seluruh pengukuran sesi tidak bisa dipercaya. */
    tanpaTumpangTindih: function () {
      var audio = state.riwayat.filter(faseAudio);
      var dengar = state.riwayat.filter(function (r) {
        return r.fase === 'dengar' && r.selesai !== null;
      });
      return !audio.some(function (b) {
        return dengar.some(function (d) { return d.mulai < b.selesai && b.mulai < d.selesai; });
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
