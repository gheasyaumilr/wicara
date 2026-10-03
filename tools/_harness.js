/* tools/_harness.js - perkakas bersama untuk pemeriksa alur di browser.
 *
 * Dipakai oleh _ui-driver.js (alur normal) dan _fail-driver.js (jalur
 * kegagalan) supaya tidak ada dua salinan logika yang bisa saling
 * menyimpang. Dimuat tepat sebelum driver, setelah app.js.
 *
 * Yang disediakan:
 *   cek(nama, ok, detail)      catat satu pernyataan
 *   judul(teks)                tulis judul bagian tanpa dinilai
 *   $, teks, html, terlihat, aktif
 *   wait, tungguSampai, tungguMs
 *                          tungguSampai menghitung putaran (25 ms per
 *                          putaran), tungguMs memakai milidetik sungguhan
 *   barisLog, barisPertamaLog
 *   dengarkan, ucapkan, lanjut  aksi tingkat halaman
 *   jalankan(prefix, fn)       jalankan fn lalu tulis hasil ke <pre id="hasil">
 */
(function () {
  'use strict';

  var baris = [];
  var lulus = 0;
  var gagal = 0;

  function cek(nama, ok, detail) {
    if (ok) { lulus++; } else { gagal++; }
    baris.push((ok ? 'LOLOS' : 'GAGAL') + ' | ' + nama +
      (detail !== undefined && detail !== null && detail !== '' ? ' | ' + detail : ''));
    return ok;
  }

  function judul(teks) { baris.push(teks); }

  function $(id) { return document.getElementById(id); }

  function teks(id) {
    var el = $(id);
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '(elemen tidak ada)';
  }

  function html(id) {
    var el = $(id);
    return el ? String(el.innerHTML || '') : '(elemen tidak ada)';
  }

  function terlihat(id) {
    var el = $(id);
    return !!el && el.hidden === false;
  }

  function aktif(id) {
    var el = $(id);
    return !!el && el.disabled === false;
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* PERHATIAN: 'batas' di sini adalah JUMLAH PUTARAN pemeriksaan, bukan
     milidetik. Satu putaran berjarak 25 ms, jadi batas 80 berarti sekitar
     2 detik dan batas 600 berarti sekitar 15 detik. Perbedaan ini pernah
     menyesatkan: penguji mengira menulis "400" berarti 400 ms, padahal
     artinya 10 detik - cukup lama bagi alur otomatis untuk berhenti sendiri
     di tengah pengujian. Kalau yang dimaksud milidetik, pakai tungguMs. */
  async function tungguSampai(fn, batas) {
    var n = 0;
    while (!fn() && n < (batas || 80)) { await wait(25); n++; }
    return fn();
  }

  /* Menunggu dengan batas waktu dalam milidetik sungguhan. */
  async function tungguMs(fn, ms) {
    var tenggat = Date.now() + (ms || 1000);
    while (!fn() && Date.now() < tenggat) { await wait(25); }
    return fn();
  }

  function barisLog() {
    var t = $('parentLog') ? $('parentLog').querySelectorAll('tbody tr') : [];
    return t.length;
  }

  function barisPertamaLog() {
    var t = $('parentLog') ? $('parentLog').querySelector('tbody tr') : null;
    return t ? String(t.textContent || '').replace(/\s+/g, ' ').trim() : '(kosong)';
  }

  /* Tekan Dengarkan lalu tunggu tombol Saya coba kembali aktif. */
  async function dengarkan() {
    $('btnListen').click();
    var selesai = await tungguSampai(function () { return aktif('btnSpeak'); }, 160);
    await wait(60);
    return selesai;
  }

  /* Tekan Saya coba lalu tunggu sampai keadaan berhenti: entah ada baris
     baru di catatan respons, entah tombol Lanjut muncul. Memakai salah satu
     saja tidak cukup - jalur tanpa STT tidak pernah menambah baris. */
  async function ucapkan(label) {
    var sebelum = window.__stub.sttStartCount;
    var barisSebelum = barisLog();

    $('btnSpeak').click();

    if (!await tungguSampai(function () { return window.__stub.sttStartCount > sebelum; }, 80)) {
      cek(label + ': rekaman dimulai', false, 'penghitung start tetap ' + sebelum);
      return false;
    }
    if (!await tungguSampai(function () { return barisLog() > barisSebelum; }, 160)) {
      cek(label + ': respons tercatat', false, 'baris log tetap ' + barisSebelum);
      return false;
    }
    await wait(40);
    return true;
  }

  /* Tekan Lanjut, opsional periksa kata berikutnya benar-benar muncul. */
  async function lanjut(kataBerikut) {
    if ($('btnNext').hidden) {
      cek('tombol Lanjut tersedia sebelum diklik', false, 'masih tersembunyi');
      return false;
    }
    $('btnNext').click();
    await wait(60);
    if (kataBerikut) {
      var pindah = await tungguSampai(function () { return teks('targetWord') === kataBerikut; }, 80);
      if (!pindah) cek('pindah ke kata ' + kataBerikut, false, 'layar menunjukkan ' + teks('targetWord'));
      return pindah;
    }
    return true;
  }

  /* Alamat penerima hasil disuntikkan _runner.js lewat alamat halaman.
     Hasilnya dikirim lewat POST supaya pengujian tidak perlu menunggu
     Chrome menutup diri - itulah yang dulu membuat kasus "gambar gagal
     dimuat" menggantung. <pre id="hasil"> tetap ditulis supaya halaman
     masih bisa diperiksa manual. */
  function urlHasil() {
    try {
      var cocok = /[?&]hasil=([^&]+)/.exec(location.search || '');
      return cocok ? decodeURIComponent(cocok[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function kirim() {
    var url = urlHasil();
    if (!url) return false;
    var badan = JSON.stringify({ judul: document.title, isi: baris.join('\n') });
    try {
      if (window.fetch) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: badan
        }).catch(function () { /* pengawas di sisi Node akan melapor */ });
        return true;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.send(badan);
      return true;
    } catch (e) {
      return false;
    }
  }

  var sudahLapor = false;

  function selesai(prefix, catatan) {
    if (sudahLapor) return;
    sudahLapor = true;

    if (catatan) {
      gagal++;
      baris.push('GAGAL | ' + catatan);
    }
    baris.push('');
    baris.push('RINGKASAN: ' + lulus + ' LOLOS / ' + gagal + ' GAGAL');

    var pre = document.createElement('pre');
    pre.id = 'hasil';
    pre.textContent = baris.join('\n');
    document.body.appendChild(pre);

    document.title = (prefix || 'UI_CHECK') + ' ' + (gagal === 0 ? 'LULUS' : 'GAGAL') +
      ' ' + lulus + '/' + (lulus + gagal);

    kirim();
  }

  function jalankan(prefix, fn, batasMs) {
    var batas = batasMs || 100000;

    function mulai() {
      /* Pengawas: kalau alur tidak selesai dalam batas waktu, halaman tetap
         melapor dengan apa yang sudah dikumpulkan. Pengujian yang menggantung
         jadi kegagalan yang terbaca, bukan diam-diam berhenti. */
      var pengawas = setTimeout(function () {
        selesai(prefix, 'alur tidak selesai dalam ' + Math.round(batas / 1000) + ' detik');
      }, batas);

      setTimeout(function () {
        fn().then(function () {
          clearTimeout(pengawas);
          selesai(prefix);
        }).catch(function (error) {
          clearTimeout(pengawas);
          selesai(prefix, 'exception: ' + String(error && error.stack || error));
        });
      }, 300);
    }

    if (document.readyState === 'complete') mulai();
    else window.addEventListener('load', mulai);
  }

  window.__harness = {
    cek: cek, judul: judul, $: $, teks: teks, html: html, terlihat: terlihat, aktif: aktif,
    wait: wait, tungguSampai: tungguSampai, tungguMs: tungguMs,
    barisLog: barisLog, barisPertamaLog: barisPertamaLog,
    dengarkan: dengarkan, ucapkan: ucapkan, lanjut: lanjut,
    selesai: selesai, jalankan: jalankan,
    baris: baris,
    hitung: function () { return { lulus: lulus, gagal: gagal }; }
  };
})();
