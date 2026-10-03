# Phase 0 — Technical PoC

Bukti teknis untuk **Speech Therapy Assistant** sesuai PRD bagian 26.
Isinya murni HTML + CSS + JavaScript. **Tidak ada server, tidak ada database.**

Sasaran produknya anak sekitar **2 tahun**. Karena itu ada dua mode latihan:

| Mode | Untuk siapa | Siapa yang menekan tombol |
|---|---|---|
| **Otomatis** (bawaan) | anak ~2 tahun | hanya orang tua, sekali di awal |
| **Tombol** | anak lebih besar | anak sendiri: Dengarkan → Saya coba → Lanjut |

Alur yang dibuktikan: gambar → instruksi audio → anak bicara → microphone →
speech-to-text → evaluasi → feedback → catatan sesi.

---

## Cara membuka

Microphone dan pengenalan suara **hanya jalan di https atau localhost**. Kalau dibuka
lewat `file://` (klik dua kali berkasnya), browser akan memblokirnya.

Karena Laragon sudah jalan:

```
Halaman latihan : http://localhost/wicara/phase0/index.html
Halaman uji     : http://localhost/wicara/phase0/test.html
```

Mode bisa dipaksa lewat alamat, berguna untuk menyimpan pintasan di layar utama tablet:

```
?mode=auto     latihan berjalan sendiri (bawaan)
?mode=tombol   anak menekan tombol sendiri
```

Kalau server web sedang mati, jalankan server statis dari folder ini:

```bash
php -S localhost:8000
# lalu buka http://localhost:8000/index.html
```

---

## Isi folder

```
phase0/
├── index.html              halaman latihan (dua mode)
├── test.html               halaman uji mandiri
├── README.md               berkas ini
├── tools/
│   ├── verify.js           pemeriksa statis + mesin evaluasi (node)
│   ├── ui-check.js         pemeriksa alur mode tombol (node + Chrome)
│   ├── fail-check.js       pemeriksa jalur kegagalan (node + Chrome)
│   ├── auto-check.js       pemeriksa alur otomatis (node + Chrome)
│   ├── _runner.js          penjalan Chrome + penerima hasil
│   ├── _harness.js         perkakas pernyataan bersama semua driver
│   ├── _stub-common.js     inti tiruan API browser
│   ├── _ui-stub.js         tiruan untuk alur mode tombol
│   ├── _fail-stub.js       tiruan untuk jalur kegagalan
│   ├── _auto-stub.js       tiruan untuk alur otomatis
│   ├── _ui-driver.js       skenario alur mode tombol
│   ├── _fail-driver.js     skenario jalur kegagalan
│   └── _auto-driver.js     skenario alur otomatis
└── assets/
    ├── css/app.css         gaya bersama
    ├── images/*.svg        10 gambar stimulus (lokal, bisa offline)
    └── js/
        ├── config.js       ambang batas, jeda, bahasa, batas waktu
        ├── exercises.js    bank 10 latihan Word Production
        ├── therapy.js      normalisasi + mesin evaluasi
        ├── speech.js       pembungkus TTS
        ├── microphone.js   izin mic + speech recognition
        ├── app.js          mesin sesi: tampilan, penilaian, ringkasan, ekspor
        ├── auto.js         alur otomatis untuk anak 2 tahun
        └── test.js         logika halaman uji
```

Gambar memakai SVG lokal, bukan tautan luar, supaya nanti siap untuk Phase 2 (offline).

---

## Mode otomatis — kenapa ada

Alur tombol menuntut anak menekan Dengarkan, lalu Saya coba, lalu Lanjut. Untuk anak
24 bulan itu tidak masuk akal: belum bisa membaca label, belum bisa menyusun urutan dua
langkah, dan pada usia itu memang bukan anak yang seharusnya mengoperasikan aplikasi.
Dalam sesi intervensi dini yang sebenarnya, yang memegang perangkat adalah orang tua
atau terapis. Tugas anak cuma tiga: lihat gambar, dengar kata, coba ucapkan.

Jadi di mode otomatis orang tua menekan **Mulai** satu kali, lalu aplikasi berjalan
sendiri:

```
tampilkan gambar → bacakan kata → jeda 650 ms → buka mikrofon, TUNGGU anak
  ├─ anak bersuara       → nilai → bunyi + animasi respons → jeda → kata berikutnya
  └─ anak belum bersuara → nada ajakan + gambar mengangguk + kata diulang
                           → jeda 650 ms → buka mikrofon lagi, tunggu lebih longgar
                           → diulang sampai 2 kali undangan
                           → baru lanjut, dengan jujur mencatat NO_RESPONSE
```

Kendali yang tersedia hanya **Mulai**, **Jeda / Lanjutkan**, dan **Berhenti**. Tidak ada
tombol di area anak.

### Kalau anak belum bersuara

Ini bagian yang paling menentukan di usia 2 tahun. Aplikasi **tidak** langsung pindah
kata ketika anak diam. Diam bukan kegagalan — anak sering butuh waktu untuk mengerti
pertanyaannya dulu, atau butuh diundang sekali lagi. Jadi anak diberi undangan:

1. **nada ajakan** — menanjak dan ramah, berbeda dari nada respons;
2. **gambar bergerak** pelan, mengangguk, mengajak memperhatikan lagi;
3. **katanya diulang** — inilah bantuan P1/P2 pada kerangka terapi
   (instruksi diulang, lalu diberi contoh);
4. jeda 650 ms lagi, lalu mikrofon dibuka lagi dengan waktu tunggu **lebih longgar**
   (6 detik pada percobaan pertama, 8 detik setelah diundang).

Setelah 2 undangan, latihan lanjut ke kata berikutnya dan hasilnya dicatat apa adanya.

**Yang membuat ini lebih dari sekadar keramahan:** setiap percobaan dicatat terpisah
beserta tingkat bantuannya, dan tingkat itu menaik otomatis — P0 lalu P1 lalu P2
(`Therapy.derivePromptLevel`). Artinya aplikasi jadi bisa membedakan:

| Yang terjadi | Hasilnya di data |
|---|---|
| anak langsung menjawab, benar | `MATCH` + `INDEPENDENT` — mandiri |
| anak menjawab setelah diundang | `MATCH` + `PROMPTED` — butuh bantuan |
| anak tidak bersuara sama sekali | `NO_RESPONSE` ×3, prompt naik P0→P1→P2 |

Tanpa undangan, ketiganya mustahil dipisahkan: semuanya jadi satu `NO_RESPONSE`, dan
justru informasi paling berharga — *berapa besar bantuan yang dibutuhkan* — hilang.
Di usia 24 bulan, "mau mencoba setelah diundang" adalah kemajuan, bukan kegagalan.

Catatan teknis yang penting: nada ajakan juga keluar dari speaker, jadi ia **ikut
dijaga aturan anti-gema**. Setiap undangan menambah satu fase ber-audio, dan pemeriksa
membuktikan tidak ada satu pun fase mendengarkan yang beririsan dengannya.

### Risiko terbesar: gema

Kalau mikrofon dibuka selagi audio diputar, pengenal suara akan mendengar suara aplikasi
sendiri dari speaker dan mencatatnya sebagai jawaban benar. Semua skor jadi 100% dan
tidak berarti apa-apa. Karena itu:

- mikrofon **tidak pernah** dibuka selama audio diputar — urutannya dipaksa di kode;
- ada jeda `listenDelayMs` (650 ms) setelah audio berhenti;
- respons memakai **nada**, bukan kata, supaya tidak ditirukan anak;
- pemeriksa membuktikan janji itu: `Auto.tanpaTumpangTindih()` dan jeda minimum per
  putaran diukur dengan nilai konfigurasi yang sebenarnya.

Yang **tidak** bisa dikendalikan dari halaman web: `SpeechRecognition` tidak menerima
opsi `echoCancellation`. Kalau anak memakai speaker (bukan earphone) dengan volume
besar, jeda 650 ms mungkin belum cukup. Naikkan `auto.listenDelayMs` di `config.js`,
atau pakai earphone. Angka 650 ms adalah pilihan sadar, bukan hasil pengukuran — itulah
salah satu hal yang perlu kamu uji dengan perangkat nyata.

### Kalau mikrofon gagal

Kegagalan alat **tidak** dicatat sebagai respons. Mencatatnya sebagai `NO_RESPONSE`
berarti menghitung mikrofon yang rusak sebagai anak yang tidak mau mencoba, dan itu
merusak angka accuracy. Setelah `maxGagalBerturut` (2) kegagalan berturut-turut, latihan
dihentikan dan orang tua diminta memeriksa izin serta koneksi.

Sebaliknya, `no-speech` **dicatat** sebagai `NO_RESPONSE` — di situ alatnya bekerja dan
anak memang belum bersuara. Di usia 2 tahun itu justru data yang paling berharga: yang
diukur adalah mau mencoba atau tidak, bukan tepat atau tidak.

---

## Cara menguji

### A. Mode otomatis — `index.html`

1. Tekan **Mulai** sekali. Latihan langsung berjalan sendiri.
2. Amati: gambar muncul, kata dibacakan, lalu lingkaran oranye berdenyut menandakan
   mikrofon terbuka.
3. Anak mengucapkan kata. Muncul bunyi respons dan gambar bergoyang.
4. Aplikasi pindah ke kata berikutnya sendiri sampai muncul ringkasan.
5. **Jeda** menghentikan sementara, **Berhenti** mengakhiri. Tombol **Orang tua** membuka
   panel untuk mengisi hasil manual dan mengunduh catatan sesi.

### B. Mode tombol — `index.html?mode=tombol`

1. Tekan **Dengarkan**. Instruksi dibacakan dua kali: "Ini bola." lalu "Coba bilang bola".
2. Tekan **Saya coba**, lalu ucapkan kata target.
3. Lihat feedback: **Bagus!** atau **Ayo coba lagi**. Tidak pernah ada kata "salah" atau
   "gagal".
4. Tekan **Lanjut** untuk pindah latihan. Selesai 10 latihan, muncul ringkasan.

Pintasan keyboard untuk uji cepat di laptop: **Spasi** = Dengarkan, **Enter** = Saya coba.
Keduanya mati di mode otomatis, karena di sana tidak ada tombol untuk anak.

### C. Halaman uji — `test.html`

Delapan bagian, dari atas ke bawah:

| Bagian | Gunanya |
|---|---|
| 1. Lingkungan dan dukungan API | memastikan https/localhost, TTS, STT, mic, IndexedDB terdeteksi |
| 2. Suara untuk instruksi | mengecek apakah ada suara bahasa Indonesia, dan mencobanya |
| 3. Izin microphone | memicu dialog izin dan melihat hasilnya |
| 4. Tes pengenalan suara | ucapkan kata, lihat apa yang ditangkap browser |
| 5. Uji mesin evaluasi | 22 kasus otomatis, harus lulus semua |
| 6. Menyetel ambang kemiripan | menggeser ambang dan melihat pengaruhnya |
| 7. Log uji suara anak | **bagian terpenting** — lihat di bawah |
| 8. Log teknis | catatan kejadian, bisa disalin |

Tombol **Salin semua hasil uji** menghasilkan satu laporan teks berisi semuanya.
Itu yang paling mudah dikirimkan kembali.

---

## Yang paling perlu diuji: bagian 7

PRD belum pernah menetapkan berapa akurasi yang bisa ditoleransi. Bagian 7 dibuat
untuk menjawabnya dengan angka, bukan dugaan.

Cara pakai, untuk setiap percobaan:

1. Isi **Kata target** (misalnya `bola`).
2. Tekan **Rekam**, minta anak mengucapkan kata itu.
3. Isi **Menurut telinga penguji** dengan apa yang benar-benar kamu dengar.
4. Kolom **Yang ditangkap aplikasi** terisi sendiri dari rekaman, boleh diedit.
5. Tekan **Tambah ke log**. Ulangi 20–30 kali dengan kata berbeda.

Hasilnya menampilkan dua angka yang menentukan hidup-matinya produk ini:

- **Salah dengar** — anak sudah mengucapkan dengan benar, tapi aplikasi bilang belum.
  Ini yang paling berbahaya: anak merasa sudah berusaha tapi dianggap salah, lalu menyerah.
- **Lolos keliru** — anak belum benar, tapi aplikasi bilang benar. Ini merusak kepercayaan terapis.

Tekan **Unduh log** untuk mendapat JSON + CSV, atau **Salin semua hasil uji** untuk teks.

---

## Bank kata

Sepuluh kata, semuanya 2 suku kata, dipilih untuk anak sekitar 24 bulan. Urutannya
disengaja dari pola suku kata termudah ke tersulit.

| # | Kata | Pola | Kesulitan |
|---|---|---|---|
| 1–5 | bola, susu, topi, mata, buku | KB-KB | 1 |
| 6–7 | apel, ikan | B-KBK | 2 |
| 8–9 | bebek, bunga | KB-KBK | 2 |
| 10 | kucing | KB-KBK | 3 |

Yang paling sering salah dikenali di usia ini adalah kata berpola KB-KBK (apel, ikan,
bebek) dan kata dengan gugus konsonan (bunga, kucing), karena anak seusia itu biasanya
belum mengucapkan konsonan akhir. Metadata ini ada di `exercises.js` dan dipakai halaman
uji untuk melihat akurasi STT per tingkat kesulitan.

---

## Keputusan yang saya ambil

PRD menyerahkan beberapa hal tanpa aturan. Untuk Phase 0 saya memilih, dan semuanya
mudah diubah:

**1. Aturan evaluasi (PRD bagian 14).** PRD menyebut MATCH / PARTIAL_MATCH / NO_MATCH
tapi tidak menetapkan cara menghitungnya. Implementasi di `therapy.js` memakai:
normalisasi teks → pencocokan persis → pencocokan utuh di dalam kalimat →
pencocokan sebagian → kemiripan Levenshtein dengan ambang 0.6. Aturan lengkapnya ada
di komentar atas `therapy.js`.

**2. Ambang 0.6.** Bisa digeser dari bagian 6 halaman uji. Yang saya temukan:
`pael` (huruf tertukar) punya kemiripan 0.50 sehingga ditolak. Kalau menurutmu terlalu
ketat untuk anak, turunkan ke 0.45. Itu sebabnya slider itu ada.

**3. Jenis respons untuk jawaban salah.** PRD mendefinisikan INDEPENDENT / PROMPTED /
IMITATED / APPROXIMATION / NO_RESPONSE, tapi tidak menjelaskan jawaban yang salah
tanpa bantuan. Saya memakai `PROMPTED`. **Ini perlu kamu putuskan** — mungkin perlu
nilai tambahan seperti `INCORRECT`, dan itu berarti mengubah PRD.

**4. Tingkat bantuan otomatis.** Percobaan 1 = P0, percobaan 2 = P1, percobaan 3 = P2.
Orang tua bisa menimpanya dari panel.

**5. Audio tidak disimpan.** Rekaman tidak diunggah dan tidak ditulis ke disk, sesuai
PRD bagian 25. MediaRecorder disiapkan di `microphone.js` tapi belum dipakai di alur
latihan.

**6. Mode bawaan adalah otomatis.** Sasaran produk adalah anak 2 tahun, jadi alur
otomatis yang jadi bawaan dan alur tombol jadi pilihan. Kalau ternyata salah, ubah satu
baris: `defaultMode` di `config.js`.

**7. Respons tidak memakai kata pujian.** Mode otomatis memberi nada, bukan suara
"Bagus!". Kalau respons memakai kata, anak bisa menirukannya dan pengukuran jadi kacau —
dan anak 2 tahun tidak bisa membaca teks pujian.

**8. Catatan teknis ikut diekspor.** Sesi yang berjalan tanpa audio atau tanpa pengenalan
suara tidak boleh ditafsirkan sama dengan sesi normal. Karena itu masalah teknis
disimpan sebagai daftar dan ikut ke dalam berkas JSON (`technical`).

---

## Batasan yang diketahui

- **Firefox tidak mendukung** SpeechRecognition sama sekali. Gunakan Chrome.
- **Safari iOS** memakai mesin dikte Siri; hasilnya sering berbeda dari Chrome, dan
  `onend` kadang tidak terpanggil sehingga batas waktu yang menyelamatkan.
- **Chrome butuh internet** untuk pengenalan suara, karena diproses di server Google.
- **Confidence hampir selalu kosong.** Jangan dipakai untuk keputusan apa pun.
- **Mode otomatis tanpa jeda yang diukur.** Jeda 650 ms adalah pilihan sadar, bukan hasil
  pengukuran pada perangkat nyata. Perlu diuji dengan speaker sungguhan.
- **Latihan yang dilewati tidak terlihat di catatan.** Kalau pengenalan suara tidak
  tersedia, latihan tetap bisa dilanjutkan tetapi tidak muncul baris di catatan respons.
  Orang tua hanya melihat peringatan di panel.
- Belum ada PWA, belum ada penyimpanan, belum ada riwayat. Itu Phase 1 dan 2.

---

## Pemeriksa otomatis

Empat pemeriksa, semuanya dijalankan dengan node dari folder `phase0`.

| Perintah | Yang diperiksa | Hasil terakhir |
|---|---|---|
| `node tools/verify.js` | syntax semua JS, mesin evaluasi, bank kata, gambar | **98 lulus, 0 gagal** |
| `node tools/ui-check.js` | alur mode tombol sampai ringkasan dan ekspor | **86 lulus, 0 gagal** |
| `node tools/fail-check.js` | 6 kasus kegagalan di mode tombol | **6/6 kasus** |
| `node tools/auto-check.js` | 4 kasus alur otomatis | **4/4 kasus** |

Kasus jalur kegagalan: `tanpaStt`, `sttDitolak`, `sttJaringan`, `tanpaTts`,
`gambarHilang`, `offline`.
Kasus alur otomatis: `normal`, `tanpaStt`, `sttJaringan`, `tanpaTts`.

Satu kasus bisa dijalankan sendiri, misalnya `node tools/fail-check.js gambarHilang`.

`index.html` tidak pernah disentuh. Pemeriksa membuat salinan sementara di `tools/`,
menjalankannya, lalu menghapusnya lagi. Kalau halaman tidak melapor sama sekali,
salinannya sengaja ditinggal supaya bisa dibuka manual di browser — jadi setelah
pengujian yang gagal, periksa dulu `tools/_*.html`. Salinan itu tidak berbahaya
(tidak dipakai halaman mana pun), tetapi kalau dibiarkan menumpuk, ia menyamarkan
salinan baru yang justru sedang kamu butuhkan.

Butuh Chrome atau Edge terpasang. Hasil halaman dikirim lewat POST ke server kecil di
Node, lalu seluruh proses Chrome dimatikan. Cara ini dipakai karena menunggu Chrome
menutup diri sendiri tidak bisa diandalkan — dulu kasus `gambarHilang` menggantung
tanpa batas.

### Satu jebakan yang perlu diketahui saat menulis skenario baru

`tungguSampai(fn, batas)` di `tools/_harness.js` menghitung **jumlah putaran
pemeriksaan**, bukan milidetik. Satu putaran berjarak 25 ms, jadi `batas = 400`
sebenarnya menunggu **10 detik**, bukan 400 ms. Ini pernah membuat kasus alur
otomatis gagal secara menyesatkan: penguji menunggu sepuluh detik untuk baris
catatan yang memang tidak akan pernah muncul, dan selama penantian itu alur
otomatis sudah berhenti sendiri — sehingga uji Jeda/Lanjutkan dijalankan pada alur
yang sudah mati.

Kalau yang dimaksud milidetik sungguhan, pakai `tungguMs(fn, ms)`.

---

## Yang sudah terbukti dan yang belum

**Terbukti otomatis.** Mode tombol berjalan dari latihan pertama sampai ringkasan,
feedback selalu positif, MATCH / PARTIAL_MATCH / NO_RESPONSE muncul benar, jenis respons
dan tingkat bantuan terisi, masukan manual berjalan, ekspor JSON lengkap. Mode otomatis
berjalan sendiri tanpa satu pun klik tambahan, jeda anti-gema diterapkan pada setiap
putaran, mikrofon tidak pernah terbuka selagi audio diputar, Jeda dan Berhenti bekerja,
dan alur berhenti dengan sopan kalau mikrofon gagal berulang. Enam kasus kegagalan
ditangani tanpa pernah menampilkan pesan teknis ke anak.

**Belum bisa diuji otomatis, dan itu bagianmu:** apakah mesin pengenal suara sanggup
menangkap ucapan anak sungguhan. Itu butuh anak, microphone, dan perangkat nyata.
Halaman uji bagian 7 adalah alat ukurnya.

---

Aplikasi ini alat bantu latihan, bukan alat diagnosis. Hasil pengenalan suara tidak
pernah dipakai sebagai penilaian klinis.
