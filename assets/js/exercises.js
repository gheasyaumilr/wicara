/* exercises.js - bank latihan MVP: Word Production (PRD bagian 12-13)
   level 4 = Word Production pada daftar 8 Exercise Level.

   Disusun untuk anak sekitar 24 bulan:
     - semua sasaran 2 suku kata, tidak ada yang 3 suku kata
     - semuanya kata benda konkret yang bisa digambar dengan jelas
     - urutan sengaja dari pola suku kata termudah (KBKB) ke tersulit
   Gambar memakai SVG lokal supaya bisa jalan tanpa internet (bekal Phase 2). */
window.DOMAIN_CODE = 'expressive_language';

window.EXERCISES = [
  { id: 'w01', target: 'bola',   display: 'BOLA',   prompt: 'Ini bola.',   instruction: 'Coba bilang bola',   image: 'assets/images/bola.svg' },
  { id: 'w02', target: 'susu',   display: 'SUSU',   prompt: 'Ini susu.',   instruction: 'Coba bilang susu',   image: 'assets/images/susu.svg' },
  { id: 'w03', target: 'topi',   display: 'TOPI',   prompt: 'Ini topi.',   instruction: 'Coba bilang topi',   image: 'assets/images/topi.svg' },
  { id: 'w04', target: 'mata',   display: 'MATA',   prompt: 'Ini mata.',   instruction: 'Coba bilang mata',   image: 'assets/images/mata.svg' },
  { id: 'w05', target: 'buku',   display: 'BUKU',   prompt: 'Ini buku.',   instruction: 'Coba bilang buku',   image: 'assets/images/buku.svg' },
  { id: 'w06', target: 'apel',   display: 'APEL',   prompt: 'Ini apel.',   instruction: 'Coba bilang apel',   image: 'assets/images/apel.svg' },
  { id: 'w07', target: 'ikan',   display: 'IKAN',   prompt: 'Ini ikan.',   instruction: 'Coba bilang ikan',   image: 'assets/images/ikan.svg' },
  { id: 'w08', target: 'bebek',  display: 'BEBEK',  prompt: 'Ini bebek.',  instruction: 'Coba bilang bebek',  image: 'assets/images/bebek.svg' },
  { id: 'w09', target: 'bunga',  display: 'BUNGA',  prompt: 'Ini bunga.',  instruction: 'Coba bilang bunga',  image: 'assets/images/bunga.svg' },
  { id: 'w10', target: 'kucing', display: 'KUCING', prompt: 'Ini kucing.', instruction: 'Coba bilang kucing', image: 'assets/images/kucing.svg' }
];

/* Dipakai halaman uji untuk mengukur akurasi STT per tingkat kesulitan.
     pattern    - pola suku kata: K = konsonan, B = vokal
     difficulty - 1 termudah, 3 tersulit
   Yang paling sering salah dikenali anak 2 tahun adalah kata berpola
   KB-KBK (apel, ikan, bebek) dan kata dengan gugus konsonan (bunga, kucing),
   karena anak seusia itu biasanya belum mengucapkan konsonan akhir. */
window.EXERCISE_META = {
  'w01': { syllables: 2, pattern: 'KB-KB',  difficulty: 1 },
  'w02': { syllables: 2, pattern: 'KB-KB',  difficulty: 1 },
  'w03': { syllables: 2, pattern: 'KB-KB',  difficulty: 1 },
  'w04': { syllables: 2, pattern: 'KB-KB',  difficulty: 1 },
  'w05': { syllables: 2, pattern: 'KB-KB',  difficulty: 1 },
  'w06': { syllables: 2, pattern: 'B-KBK',  difficulty: 2 },
  'w07': { syllables: 2, pattern: 'B-KBK',  difficulty: 2 },
  'w08': { syllables: 2, pattern: 'KB-KBK', difficulty: 2 },
  'w09': { syllables: 2, pattern: 'KB-KB',  difficulty: 2 },
  'w10': { syllables: 2, pattern: 'KB-KBK', difficulty: 3 }
};
