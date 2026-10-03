/* config.js - konfigurasi Phase 0 (PRD bagian 13-16)
   Semua angka yang perlu disetel saat pengujian ada di sini. */
window.APP_CONFIG = {
  lang: 'id-ID',

  /* Ambang batas mesin evaluasi.
     Dinaikkan  -> lebih ketat, lebih banyak PARTIAL_MATCH turun jadi NO_MATCH
     Diturunkan -> lebih longgar, lebih toleran pada pelafalan anak
     Ubah dari halaman uji (test.html) tanpa menyentuh file ini. */
  partialThreshold: 0.6,

  tts: { rate: 0.85, pitch: 1, volume: 1 },

  stt: {
    timeoutMs: 6000,
    continuous: false,
    maxAlternatives: 3
  },

  maxAttempts: 3,
  pauseBetweenPromptsMs: 450,

  /* Mode saat halaman dibuka.
       'auto'   - latihan berjalan sendiri, anak tidak menekan apa pun.
                  Ini sasaran utama produk: anak sekitar 2 tahun.
       'tombol' - anak menekan Dengarkan lalu Saya coba. Untuk anak yang
                  lebih besar.
     Bisa diganti dari panel orang tua, atau dipaksa lewat alamat
     ?mode=tombol. */
  defaultMode: 'auto',

  /* Alur otomatis. Semua angka jeda di sini adalah pengaman gema: kalau
     mikrofon dibuka terlalu cepat setelah audio, pengenal suara bisa
     mendengar suara aplikasi sendiri dari speaker dan mencatatnya sebagai
     jawaban benar. Karena itu listenDelayMs tidak boleh diturunkan di bawah
     400 ms kecuali pemakaian memakai earphone. */
  auto: {
    /* Lama mikrofon terbuka menunggu anak. Anak 2 tahun sering butuh waktu
       lebih lama daripada orang dewasa: dia perlu mengerti pertanyaannya
       dulu. Percobaan pertama lebih pendek, percobaan setelah diundang
       diberi waktu lebih longgar. */
    listenMs: 6000,
    listenMsUlang: 8000,
    listenDelayMs: 650,   /* jeda setelah audio berhenti, sebelum mikrofon dibuka */

    /* Kalau anak belum bersuara, latihan TIDAK langsung pindah. Anak diundang
       lagi dengan bantuan yang lebih jelas: nada lembut, gambar bergerak, lalu
       katanya diulang. Ini tangga bantuan P0-P4 pada kerangka terapi, dan
       hasilnya ikut tercatat - jawaban setelah diundang menjadi PROMPTED,
       bukan INDEPENDENT.

       maxUndang harus tetap sejalan dengan maxAttempts di atas: satu
       percobaan awal + maxUndang undangan = maxAttempts. Pemeriksa di
       tools/verify.js menjaga hubungan itu. */
    maxUndang: 2,
    undangDelayMs: 800,   /* jeda setelah nada undangan, sebelum kata diulang */
    ulangiKataSaatUndang: true,

    rewardDelayMs: 250,   /* jeda setelah mikrofon ditutup, sebelum bunyi respons */
    rewardMs: 1400,       /* lama respons bunyi dan animasi */
    gapMs: 700,           /* jeda sebelum kata berikutnya mulai */

    /* Kalau mikrofon gagal merekam sekian kali berturut-turut, latihan
       dihentikan dan orang tua diminta memeriksa izin serta koneksi.
       Meneruskan sisa kata tidak ada gunanya kalau tidak ada satu pun data
       yang bisa terkumpul. Catatan penting: anak yang DIAM bukan kegagalan
       alat, jadi tidak dihitung di sini. */
    maxGagalBerturut: 2,

    /* Nada respons dan nada penutup. Dipilih supaya tidak menyerupai kata
       apa pun, jadi tidak ikut ditirukan anak. */
    rewardTone: { notes: [523.25, 783.99], noteMs: 130, gain: 0.14 },
    /* Dipakai kalau ucapan belum jelas atau anak belum bersuara. Pelan dan
       menurun, bukan nada gembira - supaya tidak terasa seperti pujian palsu. */
    softTone: { notes: [392.00, 329.63], noteMs: 150, gain: 0.11 },
    /* Dipakai untuk MENGUNDANG, bukan untuk menilai. Nadanya menanjak dan
       ramah - mengajak, bukan menghibur atau menyalahkan. */
    undangTone: { notes: [587.33, 659.25], noteMs: 170, gain: 0.10 },
    finishTone: { notes: [523.25, 659.25, 783.99], noteMs: 160, gain: 0.14 }
  }
};
