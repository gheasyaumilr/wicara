/* tools/fail-check.js - pemeriksa jalur kegagalan di browser sungguhan.
 *
 *   node tools/fail-check.js            semua kasus
 *   node tools/fail-check.js tanpaStt   satu kasus saja
 *
 * PRD Prinsip 7 ("Fail Gracefully") dan US-018 mewajibkan aplikasi tetap
 * jalan - dan anak tidak pernah melihat pesan teknis - ketika pengenalan
 * suara tidak ada, izin ditolak, jaringan mati, audio tidak tersedia, atau
 * gambar gagal dimuat. Tiap kasus dijalankan di halaman terpisah karena
 * speech.js dan microphone.js menetapkan dukungan API sekali saat dimuat.
 *
 * Semua kasus di sini memakai mode tombol. Jalur kegagalan pada mode
 * otomatis diperiksa oleh auto-check.js.
 *
 * index.html sendiri tidak pernah disentuh.
 */
'use strict';

const runner = require('./_runner');

const KASUS = [
  'tanpaStt',
  'sttDitolak',
  'sttJaringan',
  'tanpaTts',
  'gambarHilang',
  'offline'
];

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
      salinan: '_fail-check-' + nama + '.html',
      pra: 'window.__KASUS_UJI = ' + JSON.stringify(nama) + ';',
      stub: 'tools/_fail-stub.js',
      driver: 'tools/_fail-driver.js',
      kueri: 'mode=tombol',
      batasMs: 60000
    });

    console.log('\n================ KASUS ' + nama + ' ================');
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

  console.log('\n================ RINGKASAN JALUR KEGAGALAN ================');
  ringkas.forEach(function (r) { console.log('  ' + r); });
  console.log('\nFAIL_CHECK ' + (gagalKasus === 0 ? 'LULUS' : 'GAGAL') +
    ' - ' + (daftar.length - gagalKasus) + '/' + daftar.length + ' kasus lolos');

  process.exit(gagalKasus === 0 ? 0 : 1);
}

main().catch(function (error) {
  console.error('Gagal: ' + (error && error.message ? error.message : error));
  process.exit(2);
});
