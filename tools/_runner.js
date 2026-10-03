/* tools/_runner.js - menjalankan satu halaman uji di Chrome headless.
 *
 * Dipakai oleh ui-check.js, fail-check.js, dan auto-check.js.
 *
 * Kenapa hasilnya dikirim lewat POST, bukan dibaca dari --dump-dom:
 * dengan --dump-dom kita harus menunggu Chrome keluar sendiri. Pada kasus
 * "gambar gagal dimuat" Chrome ternyata tidak pernah keluar, sehingga
 * pengujian menggantung tanpa batas. Sekarang halaman mengirim hasilnya ke
 * server kecil di Node, dan begitu hasil diterima seluruh pohon proses
 * Chrome dimatikan paksa. Tidak ada lagi yang bergantung pada Chrome mau
 * menutup diri.
 *
 * index.html sendiri tidak pernah disentuh: yang dijalankan adalah salinan
 * sementara di tools/ dengan tambahan <base href="../">, tiruan API, dan
 * driver.
 */
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const PENANDA_CONFIG = '<script src="assets/js/config.js"></script>';
const PENANDA_TUTUP = '</body>';

const BATAS_BAWAAN_MS = 120000;

function cariChrome() {
  const kandidat = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ];
  for (const p of kandidat) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* Menulis salinan index.html untuk satu kasus uji.
 *   salinan  nama berkas di dalam tools/
 *   pra      potongan JS yang harus jalan sebelum tiruan (mis. menandai kasus)
 *   stub     berkas tiruan khusus kasus ini
 *   driver   berkas pemeriksa
 */
function bangunSalinan(opsi) {
  const asli = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  if (asli.indexOf(PENANDA_CONFIG) === -1 || asli.indexOf(PENANDA_TUTUP) === -1) {
    throw new Error('index.html tidak lagi memuat config.js atau </body> - perbarui penanda di _runner.js');
  }

  const awal = [
    '<script src="tools/_stub-common.js"></script>',
    opsi.pra ? '<script>' + opsi.pra + '</script>' : '',
    '<script src="' + opsi.stub + '"></script>'
  ].filter(Boolean).join('\n');

  const akhir = [
    '<script src="tools/_harness.js"></script>',
    '<script src="' + opsi.driver + '"></script>'
  ].join('\n');

  const html = asli
    /* <base> supaya jalur relatif tetap menunjuk ke folder phase0, walau
       halaman salinan ada di dalam tools/. */
    .replace('<head>', '<head>\n<base href="../">')
    .replace(PENANDA_CONFIG, awal + '\n' + PENANDA_CONFIG)
    .replace(PENANDA_TUTUP, akhir + '\n' + PENANDA_TUTUP);

  const tujuan = path.join(__dirname, opsi.salinan);
  fs.writeFileSync(tujuan, html, 'utf8');
  return tujuan;
}

/* Tunggu tanpa mengunci event loop selamanya. Dipakai hanya untuk memberi
   Windows waktu melepas berkas setelah Chrome dimatikan paksa. */
function tidurMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) { /* kalau tidak didukung, lewati saja */ }
}

/* Menghapus salinan sementara. Sengaja dicoba berulang: Chrome baru saja
   dimatikan paksa, dan Windows belum tentu sudah melepas berkasnya pada
   percobaan pertama. Dulu kegagalannya ditelan diam-diam, sehingga salinan
   lama menumpuk di tools/ dan menyamarkan salinan baru yang justru sedang
   dibutuhkan saat pengujian gagal. */
function bersihkan(salinan) {
  if (!salinan) return;
  for (let i = 0; i < 12; i++) {
    try {
      if (!fs.existsSync(salinan)) return;
      fs.unlinkSync(salinan);
      return;
    } catch (e) {
      tidurMs(60);
    }
  }
  console.warn('Catatan: salinan sementara tidak bisa dihapus, silakan hapus manual: ' + salinan);
}

function matikanPohon(anak) {
  if (!anak || !anak.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(anak.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      anak.kill('SIGKILL');
    }
  } catch (e) { /* abaikan */ }
}

/* Menjalankan satu kasus. Mengembalikan Promise berisi
   { isi, judul, kode, pesan }.
   kode 0 = lulus, 1 = ada pernyataan gagal, 2 = halaman tidak melapor. */
function jalankanKasus(opsi) {
  return new Promise(function (resolve) {
    let salinan;
    try {
      salinan = bangunSalinan(opsi);
    } catch (error) {
      return resolve({
        isi: null, judul: '(gagal menyiapkan salinan)', kode: 2,
        pesan: error && error.message ? error.message : String(error)
      });
    }

    const chrome = cariChrome();
    if (!chrome) {
      bersihkan(salinan);
      return resolve({ isi: null, judul: '(tanpa Chrome)', kode: 2, pesan: 'Chrome atau Edge tidak ditemukan.' });
    }

    const batasMs = opsi.batasMs || BATAS_BAWAAN_MS;
    const profil = path.join(os.tmpdir(), 'wicara-profil-' + process.pid + '-' + Date.now());

    let hasil = null;
    let anak = null;
    let sudahSelesai = false;
    let pengawas = null;

    function tutup(kode, pesan) {
      if (sudahSelesai) return;
      sudahSelesai = true;
      if (pengawas) clearTimeout(pengawas);
      try { server.close(); } catch (e) { /* abaikan */ }
      matikanPohon(anak);
      try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* abaikan */ }

      if (!hasil) {
        /* Salinan sengaja ditinggal supaya bisa dibuka manual di browser
           sungguhan untuk melihat apa yang sebenarnya terjadi. */
        return resolve({
          isi: null, judul: '(tidak ada laporan)', kode: 2,
          pesan: (pesan || 'Halaman tidak mengirim hasil sebelum batas waktu.') +
            '\nSalinan halaman ditinggal untuk diperiksa manual: ' + salinan +
            '\nBuka http://localhost/wicara/phase0/tools/' + opsi.salinan + ' di browser.'
        });
      }

      bersihkan(salinan);
      const cocok = String(hasil.judul || '').match(/(LULUS|GAGAL) (\d+)\/(\d+)/);
      resolve({
        isi: hasil.isi,
        judul: hasil.judul,
        kode: cocok && cocok[1] === 'LULUS' ? 0 : 1
      });
    }

    const server = http.createServer(function (req, res) {
      const kepala = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' };
      if (req.method === 'POST' && req.url.indexOf('/hasil') === 0) {
        let badan = '';
        req.on('data', function (bagian) { badan += bagian; });
        req.on('end', function () {
          res.writeHead(200, kepala);
          res.end('ok');
          try { hasil = JSON.parse(badan); } catch (e) { hasil = null; }
          /* Jeda kecil supaya tanggapan HTTP sempat terkirim utuh. */
          setTimeout(function () { tutup(0); }, 40);
        });
        return;
      }
      res.writeHead(404, kepala);
      res.end('hanya menerima POST /hasil');
    });

    server.on('error', function (error) {
      bersihkan(salinan);
      if (!sudahSelesai) {
        sudahSelesai = true;
        if (pengawas) clearTimeout(pengawas);
        resolve({
          isi: null, judul: '(server gagal)', kode: 2,
          pesan: 'Server penerima hasil gagal: ' + (error && error.message ? error.message : error)
        });
      }
    });

    server.listen(0, '127.0.0.1', function () {
      const port = server.address().port;
      const kueri = ['hasil=' + encodeURIComponent('http://127.0.0.1:' + port + '/hasil')];
      if (opsi.kueri) kueri.push(opsi.kueri);
      const url = 'http://localhost/wicara/phase0/tools/' + opsi.salinan + '?' + kueri.join('&');

      pengawas = setTimeout(function () {
        tutup(2, 'Batas waktu ' + Math.round(batasMs / 1000) + ' detik terlampaui.');
      }, batasMs);

      anak = spawn(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--mute-audio',
        '--user-data-dir=' + profil,
        url
      ], { stdio: ['ignore', 'ignore', 'ignore'] });

      anak.on('error', function (error) {
        tutup(2, 'Chrome gagal dijalankan: ' + (error && error.message ? error.message : error));
      });

      anak.on('exit', function () {
        /* Kalau Chrome keluar sendiri sebelum sempat melapor, tidak ada
           gunanya menunggu sampai batas waktu. */
        setTimeout(function () {
          if (!sudahSelesai) tutup(2, 'Chrome keluar sebelum halaman melapor.');
        }, 400);
      });
    });
  });
}

module.exports = { cariChrome, bangunSalinan, jalankanKasus, bersihkan, root };
