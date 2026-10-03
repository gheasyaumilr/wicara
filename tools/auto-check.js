/* tools/auto-check.js - pemeriksa alur otomatis (mode anak 2 tahun).
 *
 *   node tools/auto-check.js               semua kasus
 *   node tools/auto-check.js tanpaStt      satu kasus saja
 *
 * Kasus 'normal' sengaja TIDAK memaksa mode lewat alamat, supaya sekaligus
 * membuktikan bahwa mode bawaan memang alur otomatis.
 *
 * Yang paling penting diperiksa di sini: mikrofon tidak pernah terbuka
 * selagi audio diputar. Kalau itu bocor, pengenal suara akan mendengar suara
 * aplikasi sendiri dari speaker dan mencatatnya sebagai jawaban benar -
 * seluruh angka sesi jadi tidak berarti.
 */
'use strict';

const runner = require('./_runner');

const KASUS = ['normal', 'tanpaStt', 'sttJaringan', 'tanpaTts', 'diam'];

async function main() {
  const diminta = process.argv[2];
  const daftar = diminta ? [diminta] : KASUS;

  if (diminta && KASUS.indexOf(diminta) === -1) {
    console.error('Kasus tidak dikenal: ' + diminta);
    console.error('Pilihan: ' + KASUS.join(', '));
    process.exit(2);
  }

  if (!runner.cariChrome()) {
    console.error('Chrome atau Edge tidak ditemukan.');
    process.exit(2);
  }

  let gagalKasus = 0;
  const ringkas = [];

  for (const nama of daftar) {
    const hasil = await runner.jalankanKasus({
      salinan: '_auto-check-' + nama + '.html',
      pra: 'window.__KASUS_UJI = ' + JSON.stringify(nama) + ';',
      stub: 'tools/_auto-stub.js',
      driver: 'tools/_auto-driver.js',
      batasMs: 180000
    });

    console.log('\n================ ALUR OTOMATIS: ' + nama + ' ================');
    if (!hasil.isi) {
      console.log('Tidak ada hasil. ' + (hasil.pesan || ''));
      console.log('Judul halaman: ' + hasil.judul);
      gagalKasus++;
      ringkas.push(nama + ': TIDAK ADA HASIL');
      continue;
    }

    console.log(hasil.isi);
    console.log('judul: ' + hasil.judul);

    const m = hasil.judul.match(/(LULUS|GAGAL) (\d+)\/(\d+)/);
    ringkas.push(nama + ': ' + (m ? m[1] + ' ' + m[2] + '/' + m[3] : 'TIDAK DIKENALI'));
    if (hasil.kode !== 0) gagalKasus++;
  }

  console.log('\n================ RINGKASAN ALUR OTOMATIS ================');
  ringkas.forEach(function (r) { console.log('  ' + r); });
  console.log('\nAUTO_CHECK ' + (gagalKasus === 0 ? 'LULUS' : 'GAGAL') +
    ' - ' + (daftar.length - gagalKasus) + '/' + daftar.length + ' kasus lolos');

  process.exit(gagalKasus === 0 ? 0 : 1);
}

main().catch(function (error) {
  console.error('Gagal: ' + (error && error.message ? error.message : error));
  process.exit(2);
});
