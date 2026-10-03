/* tools/ui-check.js - pemeriksa alur latihan normal di browser sungguhan.
 *
 *   node tools/ui-check.js
 *
 * Menjalankan index.html sekali dengan tiruan API browser yang selalu
 * berhasil, lalu memeriksa seluruh alur: Dengarkan, Saya coba, Lanjut,
 * sampai halaman ringkasan dan ekspor JSON.
 *
 * Jalur kegagalan diuji terpisah oleh fail-check.js.
 * index.html sendiri tidak pernah disentuh.
 */
'use strict';

const runner = require('./_runner');

async function main() {
  const hasil = await runner.jalankanKasus({
    salinan: '_ui-check.html',
    stub: 'tools/_ui-stub.js',
    driver: 'tools/_ui-driver.js',
    /* Mode bawaan sekarang 'auto'. Pemeriksa ini sengaja menguji alur
       tombol, jadi modenya dipaksa lewat alamat - sekaligus membuktikan
       parameter ?mode= berfungsi. */
    kueri: 'mode=tombol',
    batasMs: 160000
  });

  if (!hasil.isi) {
    console.error('\n' + (hasil.pesan || 'Halaman tidak menghasilkan apa-apa.'));
    console.error('Judul halaman yang terbaca: ' + hasil.judul);
    process.exit(2);
  }

  console.log('\n' + hasil.isi + '\n');
  console.log('Judul halaman: ' + hasil.judul);

  process.exit(hasil.kode);
}

main().catch(function (error) {
  console.error('Gagal: ' + (error && error.message ? error.message : error));
  process.exit(2);
});
