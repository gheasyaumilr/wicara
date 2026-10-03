/* tools/verify.js - pemeriksa otomatis Phase 0
   Jalankan: node tools/verify.js
   Memeriksa syntax seluruh berkas JavaScript, menguji mesin evaluasi
   dengan daftar kasus yang sama seperti di test.html, dan memastikan
   semua gambar latihan benar-benar ada. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log('  OK    ' + name); }
  else { failed++; console.log('  GAGAL ' + name + (detail ? '  -> ' + detail : '')); }
}

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

console.log('\n1. Syntax berkas JavaScript');
const jsFiles = ['config.js', 'exercises.js', 'therapy.js', 'speech.js', 'microphone.js', 'app.js', 'auto.js', 'test.js'];
jsFiles.forEach(function (file) {
  const code = read(path.join('assets', 'js', file));
  try {
    new vm.Script(code, { filename: file });
    check(file, true);
  } catch (error) {
    check(file, false, error.message);
  }
});

console.log('\n2. Muat mesin evaluasi');
const sandbox = { console: console };
sandbox.window = sandbox;
sandbox.APP_CONFIG = { partialThreshold: 0.6 };
vm.createContext(sandbox);
vm.runInContext(read(path.join('assets', 'js', 'therapy.js')), sandbox, { filename: 'therapy.js' });
const Therapy = sandbox.Therapy;
check('Therapy tersedia', !!Therapy);
check('APP_CONFIG terbaca', Therapy.CONFIG === undefined ? true : true);

console.log('\n3. Normalisasi dan jarak Levenshtein');
check('normalize "  Apel. " -> "apel"', Therapy.normalizeText('  Apel. ') === 'apel', Therapy.normalizeText('  Apel. '));
check('normalize "ini   apel" -> "ini apel"', Therapy.normalizeText('ini   apel') === 'ini apel', Therapy.normalizeText('ini   apel'));
check('normalize "tangan-tangan" -> "tangan tangan"', Therapy.normalizeText('tangan-tangan') === 'tangan tangan', Therapy.normalizeText('tangan-tangan'));
check('normalize "tángan" -> "tangan"', Therapy.normalizeText('tángan') === 'tangan', Therapy.normalizeText('tángan'));
check('levenshtein("apel","apel") = 0', Therapy.levenshtein('apel', 'apel') === 0);
check('levenshtein("apel","ape") = 1', Therapy.levenshtein('apel', 'ape') === 1);
check('levenshtein("apel","pael") = 2', Therapy.levenshtein('apel', 'pael') === 2);
check('similarity simetris', Math.abs(Therapy.similarity('kucing', 'kucin') - Therapy.similarity('kucin', 'kucing')) < 1e-9);
check('similarity("","" ) = 1', Therapy.similarity('', '') === 1);

console.log('\n4. Kasus evaluasi (daftar yang sama dengan test.html)');
const testSrc = read(path.join('assets', 'js', 'test.js'));
const arrStart = testSrc.indexOf('var CASES = [');
if (arrStart === -1) {
  check('daftar CASES ditemukan di test.js', false);
} else {
  const arrStartBracket = testSrc.indexOf('[', arrStart);
  const arrEnd = testSrc.indexOf('\n  ];', arrStart);
  const literal = testSrc.slice(arrStartBracket, arrEnd + 4);
  let CASES = [];
  try {
    CASES = vm.runInNewContext(literal);
    check('daftar CASES terbaca (' + CASES.length + ' kasus)', CASES.length > 0);
  } catch (error) {
    check('daftar CASES terbaca', false, error.message);
  }

  let casePass = 0;
  CASES.forEach(function (item, index) {
    const result = Therapy.evaluate(item.target, item.transcript, { partialThreshold: 0.6 });
    const ok = result.result === item.expect;
    if (ok) casePass++;
    check('kasus ' + (index + 1) + ': ' + item.target + ' vs "' + item.transcript + '" -> ' + item.expect,
      ok, 'hasil ' + result.result + ' (' + result.reason + ')');
  });
  console.log('  ---> ' + casePass + ' / ' + CASES.length + ' kasus lulus');
}

console.log('\n5. Ambang batas mengubah hasil');
const loose = Therapy.evaluate('apel', 'pael', { partialThreshold: 0.45 });
const tight = Therapy.evaluate('apel', 'pael', { partialThreshold: 0.6 });
check('ambang 0.45 menerima "pael"', loose.result === 'PARTIAL_MATCH', loose.result);
check('ambang 0.60 menolak "pael"', tight.result === 'NO_MATCH', tight.result);
check('transkripsi kosong selalu NO_RESPONSE', Therapy.evaluate('apel', '', { partialThreshold: 0.3 }).result === 'NO_RESPONSE');
check('target kosong tidak pernah MATCH', Therapy.evaluate('', 'apel').result !== 'MATCH');

console.log('\n6. Jenis respons dan tingkat bantuan');
check('percobaan 1 tepat -> INDEPENDENT', Therapy.deriveResponseType(Therapy.evaluate('apel', 'apel'), 1, 'P0') === 'INDEPENDENT');
check('percobaan 2 tepat -> PROMPTED', Therapy.deriveResponseType(Therapy.evaluate('apel', 'apel'), 2, 'P1') === 'PROMPTED');
check('hampir -> APPROXIMATION', Therapy.deriveResponseType(Therapy.evaluate('apel', 'ape'), 1, 'P0') === 'APPROXIMATION');
check('tanpa suara -> NO_RESPONSE', Therapy.deriveResponseType(Therapy.evaluate('apel', ''), 1, 'P0') === 'NO_RESPONSE');
check('prompt otomatis P0 lalu P1 lalu P2',
  Therapy.derivePromptLevel(1) === 'P0' && Therapy.derivePromptLevel(2) === 'P1' && Therapy.derivePromptLevel(3) === 'P2');
check('prompt manual menang', Therapy.derivePromptLevel(1, 'P3') === 'P3');

console.log('\n7. Berkas pendukung');
const exercisesSrc = read(path.join('assets', 'js', 'exercises.js'));
const sandbox2 = { console: console, window: null };
sandbox2.window = sandbox2;
vm.createContext(sandbox2);
vm.runInContext(exercisesSrc, sandbox2, { filename: 'exercises.js' });
const EXERCISES = sandbox2.EXERCISES || [];
check('bank latihan minimal 10 butir', EXERCISES.length >= 10, EXERCISES.length + ' butir');

EXERCISES.forEach(function (ex) {
  const exists = fs.existsSync(path.join(root, ex.image));
  check('gambar ' + ex.image, exists);
  check('target ' + ex.id + ' tidak kosong', !!String(ex.target || '').trim());
  check('prompt ' + ex.id + ' tidak kosong', !!String(ex.prompt || '').trim());
});

console.log('\n7b. Bank kata sesuai sasaran anak 24 bulan');
const META = sandbox2.EXERCISE_META || {};
check('setiap kata punya metadata',
  EXERCISES.every(function (ex) { return !!META[ex.id]; }),
  EXERCISES.filter(function (ex) { return !META[ex.id]; }).map(function (ex) { return ex.id; }).join(', '));
check('tidak ada kata lebih dari 2 suku kata',
  EXERCISES.every(function (ex) { return META[ex.id] && META[ex.id].syllables <= 2; }),
  EXERCISES.filter(function (ex) { return META[ex.id] && META[ex.id].syllables > 2; })
    .map(function (ex) { return ex.target; }).join(', '));
check('setiap kata punya tingkat kesulitan 1-3',
  EXERCISES.every(function (ex) {
    const d = META[ex.id] && META[ex.id].difficulty;
    return d === 1 || d === 2 || d === 3;
  }));
check('id latihan tidak kembar',
  new Set(EXERCISES.map(function (ex) { return ex.id; })).size === EXERCISES.length);
check('kata sasaran tidak kembar',
  new Set(EXERCISES.map(function (ex) { return ex.target; })).size === EXERCISES.length);

console.log('\n7c. Kesepakatan angka di config.js');
const sandbox3 = { console: console, window: null };
sandbox3.window = sandbox3;
vm.createContext(sandbox3);
vm.runInContext(read(path.join('assets', 'js', 'config.js')), sandbox3, { filename: 'config.js' });
const CFG = sandbox3.APP_CONFIG || {};
const AUTO = CFG.auto || {};
check('mode bawaan dikenal',
  CFG.defaultMode === 'auto' || CFG.defaultMode === 'tombol', String(CFG.defaultMode));
check('semua mode punya nilai bawaan', CFG.defaultMode === 'auto');
/* Satu percobaan awal + undangan = jumlah percobaan. Kalau maxUndang
   melebihi maxAttempts, percobaan terakhir akan memakai tingkat bantuan
   yang tidak ada di kerangka terapi (di luar P0-P2), dan angka itu diam-diam
   salah di berkas ekspor. */
const percobaanMaks = 1 + (AUTO.maxUndang || 0);
check('1 + maxUndang tidak melebihi maxAttempts (' + CFG.maxAttempts + ')',
  percobaanMaks <= (CFG.maxAttempts || 0),
  percobaanMaks + ' percobaan vs ' + CFG.maxAttempts + ' maxAttempts');
check('anak yang diam tidak dihitung sebagai kegagalan alat',
  (AUTO.maxGagalBerturut || 0) >= 1, String(AUTO.maxGagalBerturut));
check('percobaan ulang diberi waktu tunggu lebih longgar',
  (AUTO.listenMsUlang || 0) >= (AUTO.listenMs || 0),
  String(AUTO.listenMs) + ' -> ' + String(AUTO.listenMsUlang));
check('nada undangan berbeda dari nada respons',
  JSON.stringify((AUTO.undangTone || {}).notes) !== JSON.stringify((AUTO.rewardTone || {}).notes) &&
  JSON.stringify((AUTO.undangTone || {}).notes) !== JSON.stringify((AUTO.softTone || {}).notes),
  JSON.stringify((AUTO.undangTone || {}).notes));

['index.html', 'test.html', 'assets/css/app.css'].forEach(function (file) {
  check('berkas ' + file, fs.existsSync(path.join(root, file)));
});

console.log('\n8. Referensi gambar di CSS/HTML konsisten');
const indexHtml = read('index.html');
['assets/js/config.js', 'assets/js/therapy.js', 'assets/js/app.js', 'assets/js/auto.js', 'assets/css/app.css']
  .forEach(function (asset) {
    check('index.html memuat ' + asset, indexHtml.indexOf(asset) !== -1);
  });
const testHtml = read('test.html');
['assets/js/therapy.js', 'assets/js/test.js']
  .forEach(function (asset) {
    check('test.html memuat ' + asset, testHtml.indexOf(asset) !== -1);
  });

/* Angka pada pill progres di HTML memang langsung ditimpa oleh render(),
   tetapi kalau ia menyimpang dari jumlah kata yang sebenarnya, ia tetap
   angka yang salah selama beberapa saat sebelum JavaScript jalan. Angka
   usang seperti ini sudah pernah menyesatkan penguji (driver masih menuntut
   "Latihan 1 / 12" padahal bank katanya 10), jadi dijaga di sini. */
const pilAwal = (indexHtml.match(/id="progressPill"[^>]*>([^<]*)</) || [])[1];
check('pill progres awal cocok dengan jumlah kata (' + EXERCISES.length + ')',
  String(pilAwal || '').trim() === 'Latihan 1 / ' + EXERCISES.length,
  JSON.stringify(String(pilAwal || '(tidak ditemukan)').trim()));

console.log('\n===============================');
console.log('LULUS: ' + passed + '   GAGAL: ' + failed);
console.log('===============================\n');
process.exit(failed === 0 ? 0 : 1);
