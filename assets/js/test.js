/* test.js - halaman uji mandiri Phase 0
   Menguji: dukungan API, TTS, izin microphone, STT, mesin evaluasi,
   penyetelan ambang, dan pencatatan akurasi suara anak. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var logs = [];
  var trials = [];
  var lastStt = null;
  var recording = false;

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clock() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }

  function log(message, tone) {
    var line = { at: clock(), message: String(message), tone: tone || 'info' };
    logs.push(line);
    if (logs.length > 400) logs.shift();
    var panel = $('logPanel');
    if (panel) {
      panel.innerHTML += '<div><span class="log-time">' + line.at + '</span>  ' +
        '<span class="log-' + line.tone + '">' + escapeHtml(line.message) + '</span></div>';
      panel.scrollTop = panel.scrollHeight;
    }
  }

  function badge(text, kind) {
    return '<span class="badge badge-' + kind + '">' + escapeHtml(text) + '</span>';
  }

  function capRow(name, ok, value, kindWhenBad) {
    var kind = ok === true ? 'ok' : (ok === 'warn' ? 'warn' : (ok === 'neutral' ? 'neutral' : (kindWhenBad || 'bad')));
    var label = ok === true ? 'tersedia' : (ok === 'warn' ? 'terbatas' : (ok === 'neutral' ? 'info' : 'tidak ada'));
    return '<div class="cap-item"><span>' + escapeHtml(name) + '</span>' +
      '<span class="cap-value">' + badge(label, kind) +
      (value ? '<br>' + escapeHtml(value) : '') + '</span></div>';
  }

  /* ------------------------------------------------------- 1. kemampuan browser */

  function renderCapabilities() {
    var host = $('capList');
    if (!host) return;

    var secure = global_mic().secureContext();
    var sttSupported = !!global_mic().sttSupported;
    var ttsSupported = !!(window.TTS && TTS.supported);
    var idVoices = ttsSupported ? TTS.idVoiceCount() : 0;
    var hasGum = global_mic().hasGetUserMedia();
    var hasRec = !!window.MediaRecorder;
    var hasIdb = !!window.indexedDB;
    var online = navigator.onLine;

    var html = '';
    html += capRow('Halaman aman (https atau localhost)', secure, location.protocol + '//' + location.host, 'bad');
    html += capRow('Pembaca instruksi (SpeechSynthesis)', ttsSupported, ttsSupported ? (TTS.getVoices().length + ' suara terpasang') : 'tidak didukung');
    html += capRow('Suara bahasa Indonesia', idVoices > 0 ? true : 'warn', idVoices + ' suara berawalan "id"');
    html += capRow('Pengenalan suara (SpeechRecognition)', sttSupported, global_mic().recognitionName || 'tidak didukung');
    html += capRow('Akses microphone (getUserMedia)', hasGum, hasGum ? 'tersedia' : 'butuh https atau localhost');
    html += capRow('Perekam audio (MediaRecorder)', hasRec, hasRec ? 'tersedia' : 'tidak didukung');
    html += capRow('Penyimpanan lokal (IndexedDB)', hasIdb, hasIdb ? 'siap untuk Phase 2' : 'tidak didukung');
    html += capRow('Koneksi internet', online ? true : 'warn', online ? 'online' : 'offline');

    host.innerHTML = html;
  }

  function global_mic() { return window.Mic || { secureContext: function () { return false; }, sttSupported: false, recognitionName: null, hasGetUserMedia: function () { return false; } }; }

  /* ---------------------------------------------------------------- 2. TTS */

  function renderVoices() {
    var host = $('voiceList');
    if (!host) return;
    if (!window.TTS || !TTS.supported) {
      host.innerHTML = '<p class="hint hint-warn">Browser ini tidak mendukung SpeechSynthesis.</p>';
      if ($('voiceCount')) $('voiceCount').textContent = 'tidak didukung';
      return;
    }
    var voices = TTS.readVoices();
    var id = voices.filter(function (v) { return String(v.lang || '').toLowerCase().indexOf('id') === 0; });
    var picked = TTS.pickVoice('id-ID');

    if ($('voiceCount')) {
      $('voiceCount').textContent = voices.length + ' suara terpasang, ' + id.length + ' berbahasa Indonesia';
    }

    var rows = voices.map(function (v) {
      var isId = String(v.lang || '').toLowerCase().indexOf('id') === 0;
      var isPicked = picked && v.name === picked.name;
      return '<tr><td>' + escapeHtml(v.name) + '</td>' +
        '<td>' + escapeHtml(v.lang || '-') + '</td>' +
        '<td>' + (v.localService ? 'lokal' : 'jaringan') + '</td>' +
        '<td>' + (isPicked ? badge('dipakai', 'ok') : (isId ? badge('id', 'warn') : '')) + '</td></tr>';
    }).join('');

    host.innerHTML = '<table class="table"><thead><tr><th>Nama suara</th><th>Bahasa</th><th>Jenis</th><th></th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4" class="muted">Belum ada suara terdeteksi. Coba tekan "Muat ulang daftar suara".</td></tr>') + '</tbody></table>' +
      (id.length === 0 ? '<p class="hint hint-warn" style="margin-top:10px">Tidak ada suara bahasa Indonesia. Instruksi akan dibacakan dengan suara default, yang biasanya terdengar asing untuk anak.</p>' : '');

    log('Daftar suara dimuat: ' + voices.length + ' total, ' + id.length + ' bahasa Indonesia.', id.length ? 'ok' : 'warn');
  }

  function speakTest() {
    var text = $('ttsText') ? $('ttsText').value : '';
    if (!text.trim()) { setHint('ttsStatus', 'Isi kalimat uji dulu.', 'warn'); return; }
    setHint('ttsStatus', 'Sedang memutar...', '');
    var startedAt = Date.now();
    TTS.speak(text).then(function (result) {
      var ms = Date.now() - startedAt;
      if (result.spoken) {
        setHint('ttsStatus', 'Berhasil diputar dalam ' + ms + ' ms dengan suara "' + (result.voice || 'default') + '".', 'ok');
        log('TTS berhasil: ' + text, 'ok');
      } else if (result.timedOut) {
        setHint('ttsStatus', 'Suara tidak selesai dalam batas waktu. Di beberapa browser ini normal, tapi patut dicatat.', 'warn');
        log('TTS berakhir karena batas waktu.', 'warn');
      } else {
        setHint('ttsStatus', 'Pemutaran dihentikan.', 'warn');
      }
    }).catch(function (error) {
      setHint('ttsStatus', 'Gagal: ' + (error && error.message ? error.message : error), 'warn');
      log('TTS gagal: ' + (error && error.message ? error.message : error), 'bad');
    });
  }

  function setHint(id, text, tone) {
    var el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'hint' + (tone ? ' hint-' + tone : '');
  }

  /* ------------------------------------------------------------ 3. microphone */

  function askMic() {
    setHint('micResult', 'Menunggu jawaban izin dari browser...', '');
    Mic.requestPermission().then(function (result) {
      if (result.granted) {
        var names = result.tracks.map(function (t) { return t.label || '(tanpa nama)'; }).join(', ');
        setHint('micResult', 'Izin diberikan. Perangkat: ' + names, 'ok');
        log('Izin microphone diberikan: ' + names, 'ok');
      } else {
        setHint('micResult', result.message, 'warn');
        log('Izin microphone gagal: ' + result.error, 'bad');
      }
      refreshMicState();
    });
  }

  function refreshMicState() {
    Mic.permissionState().then(function (state) {
      var el = $('micState');
      if (el) el.textContent = 'status izin: ' + state;
    });
  }

  /* ------------------------------------------------------------------ 4. STT */

  function sttRecord() {
    if (recording) return;
    var target = $('sttTarget') ? $('sttTarget').value : '';
    recording = true;
    setHint('sttStatus', 'Mendengarkan... ucapkan kata target sekarang.', '');
    setRaw('sttRaw', '', true);
    if ($('sttAlts')) $('sttAlts').innerHTML = '';
    if ($('sttVerdict')) $('sttVerdict').innerHTML = '';
    if ($('sttMeta')) $('sttMeta').textContent = 'durasi: -';

    Mic.listen({
      onInterim: function (text) {
        if (text) setHint('sttStatus', 'Mendengarkan... "' + text + '"', '');
      }
    }).then(function (result) {
      recording = false;
      lastStt = result;

      if (!result.ok) {
        setHint('sttStatus', result.message || 'Pengenalan suara gagal.', 'warn');
        log('STT gagal: ' + (result.error || 'unknown'), 'bad');
        return;
      }

      var transcript = result.transcript || '';
      setRaw('sttRaw', transcript, !transcript);
      if ($('sttMeta')) {
        $('sttMeta').textContent = 'durasi: ' + (result.durationMs || 0) + ' ms' +
          (result.timedOut ? ' (berhenti karena batas waktu)' : '') +
          ' | bahasa: ' + (result.lang || '-');
      }
      setHint('sttStatus', transcript ? 'Selesai. Bandingkan hasilnya dengan kata target.' : 'Tidak ada suara yang terbaca. Coba lagi dengan suara lebih jelas.', transcript ? 'ok' : 'warn');

      renderAlternatives(result.alternatives || []);

      if (target.trim()) {
        var evaluation = Therapy.evaluate(target, transcript);
        renderVerdict($('sttVerdict'), target, transcript, evaluation);
        log('STT: target "' + target + '" -> terdengar "' + transcript + '" -> ' + evaluation.result, evaluation.result === 'MATCH' ? 'ok' : 'warn');
      }
    });
  }

  function setRaw(id, text, empty) {
    var el = $(id);
    if (!el) return;
    if (!text || empty) {
      el.innerHTML = '<span class="empty">' + (text ? '' : 'Transkripsi akan muncul di sini.') + '</span>' +
        (text ? '<span class="big">' + escapeHtml(text) + '</span>' : '');
      if (text) el.innerHTML = '<span class="big">' + escapeHtml(text) + '</span>';
      return;
    }
    el.innerHTML = '<span class="big">' + escapeHtml(text) + '</span>';
  }

  function renderAlternatives(alternatives) {
    var host = $('sttAlts');
    if (!host) return;
    if (!alternatives.length) { host.innerHTML = ''; return; }
    var rows = alternatives.map(function (a) {
      return '<tr><td>' + escapeHtml(a.transcript || '-') + '</td><td>' +
        (a.confidence === null || a.confidence === undefined ? '<span class="muted">tidak dilaporkan</span>' : a.confidence) +
        '</td></tr>';
    }).join('');
    host.innerHTML = '<p class="small muted" style="margin:0 0 6px">Kandidat lain yang dipertimbangkan browser</p>' +
      '<table class="table"><thead><tr><th>Kandidat</th><th>Confidence</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="small muted" style="margin:6px 0 0">Confidence sering kosong pada Web Speech API, jadi jangan dijadikan dasar keputusan.</p>';
  }

  function renderVerdict(host, target, transcript, evaluation) {
    if (!host) return;
    var tone = evaluation.result === 'MATCH' ? 'ok' : (evaluation.result === 'NO_MATCH' || evaluation.result === 'NO_RESPONSE' ? 'bad' : 'warn');
    host.innerHTML =
      '<div class="result-line result-' + tone + '">' +
      'Hasil: <strong>' + evaluation.result + '</strong> - ' + escapeHtml(evaluation.reason) +
      ' (kemiripan ' + evaluation.similarity + ', ambang ' + evaluation.threshold + ')' +
      '</div>' +
      '<p class="small muted" style="margin:6px 0 0">Target dinormalisasi: "' + escapeHtml(evaluation.target) +
      '" | terdengar: "' + escapeHtml(evaluation.transcript || '') + '"</p>';
  }

  /* ----------------------------------------------------- 5. mesin evaluasi */

  var CASES = [
    { target: 'apel', transcript: 'apel', expect: 'MATCH', note: 'sama persis' },
    { target: 'apel', transcript: 'Apel.', expect: 'MATCH', note: 'huruf besar dan tanda baca dibuang' },
    { target: 'apel', transcript: '   apel   ', expect: 'MATCH', note: 'spasi berlebih dirapikan' },
    { target: 'apel', transcript: 'ini apel', expect: 'MATCH', note: 'target terucap utuh di dalam kalimat' },
    { target: 'apel', transcript: 'ape', expect: 'PARTIAL_MATCH', note: 'satu huruf hilang' },
    { target: 'apel', transcript: 'apelnya', expect: 'PARTIAL_MATCH', note: 'ada tambahan akhiran' },
    { target: 'apel', transcript: 'apal', expect: 'PARTIAL_MATCH', note: 'vokal bergeser' },
    { target: 'apel', transcript: 'mangga', expect: 'NO_MATCH', note: 'kata yang berbeda' },
    { target: 'apel', transcript: 'ini bola', expect: 'NO_MATCH', note: 'kalimat benar tapi kata salah' },
    { target: 'apel', transcript: 'pael', expect: 'NO_MATCH', note: 'huruf tertukar, di bawah ambang 0.6' },
    { target: 'apel', transcript: '', expect: 'NO_RESPONSE', note: 'tidak ada suara' },
    { target: 'apel', transcript: '     ', expect: 'NO_RESPONSE', note: 'hanya spasi' },
    { target: 'kucing', transcript: 'kucing', expect: 'MATCH', note: 'kata tiga suku kata' },
    { target: 'kucing', transcript: 'kucin', expect: 'PARTIAL_MATCH', note: 'suku kata akhir melemah' },
    { target: 'kucing', transcript: 'kucingnya', expect: 'PARTIAL_MATCH', note: 'ada tambahan akhiran' },
    { target: 'sepatu', transcript: 'sapatu', expect: 'PARTIAL_MATCH', note: 'vokal bergeser' },
    { target: 'sepatu', transcript: 'patu', expect: 'PARTIAL_MATCH', note: 'suku kata awal hilang' },
    { target: 'mata', transcript: 'mata mata', expect: 'MATCH', note: 'diulang, target tetap utuh' },
    { target: 'mata', transcript: 'kaka', expect: 'NO_MATCH', note: 'kata yang berbeda' },
    { target: 'bola', transcript: 'bota', expect: 'PARTIAL_MATCH', note: 'satu konsonan bergeser' },
    { target: 'tangan', transcript: 'tángan', expect: 'MATCH', note: 'tanda diakritik dibuang saat normalisasi' },
    { target: 'tangan', transcript: 'tangan-tangan', expect: 'MATCH', note: 'tanda hubung dibuang' }
  ];

  function runCases() {
    var body = $('caseBody');
    if (!body) return;
    var pass = 0;
    var rows = CASES.map(function (item, index) {
      var evaluation = Therapy.evaluate(item.target, item.transcript, { partialThreshold: 0.6 });
      var ok = evaluation.result === item.expect;
      if (ok) pass++;
      return '<tr><td>' + (index + 1) + '</td>' +
        '<td>' + escapeHtml(item.target) + '</td>' +
        '<td>' + (item.transcript ? escapeHtml(item.transcript) : '<span class="muted">(kosong)</span>') + '</td>' +
        '<td>' + badge(item.expect, ok ? 'ok' : 'bad') + '</td>' +
        '<td>' + (ok ? badge('sesuai', 'ok') : badge('tidak sesuai', 'bad')) + '</td>' +
        '<td class="muted">' + escapeHtml(item.note) + '</td></tr>';
    }).join('');

    body.innerHTML = '<table class="table"><thead><tr>' +
      '<th>#</th><th>Target</th><th>Transkripsi</th><th>Harapan</th><th>Status</th><th>Keterangan</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    var summary = $('caseSummary');
    if (summary) {
      summary.innerHTML = pass === CASES.length
        ? badge(pass + ' / ' + CASES.length + ' lulus', 'ok')
        : badge(pass + ' / ' + CASES.length + ' lulus', 'bad');
    }
    log('Uji mesin evaluasi: ' + pass + ' dari ' + CASES.length + ' kasus lulus.', pass === CASES.length ? 'ok' : 'bad');
  }

  /* ------------------------------------------------------- 6. ambang batas */

  var PROBES = [
    ['apel', 'apel'], ['apel', 'apal'], ['apel', 'ape'], ['apel', 'apet'],
    ['apel', 'pael'], ['apel', 'ap'], ['apel', 'eper'], ['apel', 'apelnya'],
    ['bola', 'bota'], ['bola', 'boa'], ['bola', 'bal'], ['bola', 'bolla'],
    ['kucing', 'kucin'], ['kucing', 'kucinng'], ['kucing', 'kucingku'],
    ['sepatu', 'sapatu'], ['sepatu', 'patu'], ['sepatu', 'sepat'],
    ['tangan', 'tapan'], ['tangan', 'tanga'], ['topi', 'top'], ['topi', 'topih']
  ];

  function currentThreshold() {
    var el = $('threshold');
    return el ? Number(el.value) : 0.6;
  }

  function renderProbes() {
    var host = $('probeBody');
    if (!host) return;
    var threshold = currentThreshold();
    var rows = PROBES.map(function (pair) {
      var evaluation = Therapy.evaluate(pair[0], pair[1], { partialThreshold: threshold });
      var tone = evaluation.result === 'MATCH' ? 'ok' : (evaluation.result === 'PARTIAL_MATCH' ? 'warn' : 'bad');
      var contained = evaluation.reason.indexOf('terbaca') !== -1;
      return '<tr><td>' + escapeHtml(pair[0]) + '</td>' +
        '<td>' + escapeHtml(pair[1]) + '</td>' +
        '<td>' + evaluation.similarity.toFixed(2) + '</td>' +
        '<td>' + badge(evaluation.result, tone) + '</td>' +
        '<td class="muted">' + (contained ? 'lolos karena salah satu memuat yang lain' : '') + '</td></tr>';
    }).join('');

    host.innerHTML = '<table class="table"><thead><tr>' +
      '<th>Target</th><th>Terdengar</th><th>Kemiripan</th><th>Hasil pada ambang ' + threshold.toFixed(2) + '</th><th></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function onThreshold() {
    var value = currentThreshold();
    if ($('thresholdValue')) $('thresholdValue').textContent = value.toFixed(2);
    if (window.APP_CONFIG) APP_CONFIG.partialThreshold = value;
    renderProbes();
    evalCustom();
  }

  function evalCustom() {
    var host = $('customResult');
    if (!host) return;
    var target = $('customTarget') ? $('customTarget').value : '';
    var transcript = $('customTranscript') ? $('customTranscript').value : '';
    if (!target.trim() && !transcript.trim()) { host.innerHTML = ''; return; }
    var evaluation = Therapy.evaluate(target, transcript, { partialThreshold: currentThreshold() });
    renderVerdict(host, target, transcript, evaluation);
  }

  /* --------------------------------------------------------- 7. log uji anak */

  function addTrial() {
    var target = ($('trialTarget') ? $('trialTarget').value : '').trim();
    var said = ($('trialSaid') ? $('trialSaid').value : '').trim();
    var heard = ($('trialHeard') ? $('trialHeard').value : '').trim();
    var child = ($('trialChild') ? $('trialChild').value : '').trim();

    if (!target) { log('Kata target belum diisi, catatan tidak ditambahkan.', 'warn'); return; }
    if (!said && !heard) { log('Isi minimal salah satu: ucapan anak atau hasil tangkapan aplikasi.', 'warn'); return; }

    var threshold = (window.APP_CONFIG && APP_CONFIG.partialThreshold) || 0.6;
    var childEval = Therapy.evaluate(target, said, { partialThreshold: threshold });
    var appEval = Therapy.evaluate(target, heard, { partialThreshold: threshold });

    var childOk = childEval.result === 'MATCH';
    var appOk = appEval.result === 'MATCH';
    var saidNorm = Therapy.normalizeText(said);
    var heardNorm = Therapy.normalizeText(heard);
    var agree = saidNorm === heardNorm;

    var trial = {
      at: new Date().toISOString(),
      child: child || null,
      target: target,
      said: said,
      heard: heard,
      similarity: appEval.similarity,
      appResult: appEval.result,
      childResult: childEval.result,
      childOk: childOk,
      appOk: appOk,
      sttAgreesWithParent: agree,
      falseNegative: childOk && !appOk,
      falsePositive: !childOk && appOk,
      threshold: threshold
    };
    trials.push(trial);

    if ($('trialSaid')) $('trialSaid').value = '';
    if ($('trialHeard')) $('trialHeard').value = '';

    renderTrials();
    log('Catatan ditambahkan: ' + target + ' -> "' + heard + '" (' + appEval.result + ')',
      trial.falseNegative ? 'bad' : (trial.falsePositive ? 'warn' : 'ok'));
  }

  function trialSummary() {
    var total = trials.length;
    var agree = trials.filter(function (t) { return t.sttAgreesWithParent; }).length;
    var appOk = trials.filter(function (t) { return t.appOk; }).length;
    var childOk = trials.filter(function (t) { return t.childOk; }).length;
    var falseNeg = trials.filter(function (t) { return t.falseNegative; });
    var falsePos = trials.filter(function (t) { return t.falsePositive; });
    return {
      total: total,
      agree: agree,
      agreeRate: total ? Number(((agree / total) * 100).toFixed(1)) : 0,
      appOk: appOk,
      appOkRate: total ? Number(((appOk / total) * 100).toFixed(1)) : 0,
      childOk: childOk,
      falseNegatives: falseNeg,
      falsePositives: falsePos
    };
  }

  function renderTrials() {
    var s = trialSummary();
    var summaryHost = $('trialSummary');
    var bodyHost = $('trialBody');
    if (!summaryHost || !bodyHost) return;

    if (!s.total) {
      summaryHost.innerHTML = '<p class="hint">Belum ada catatan. Setiap percobaan yang dicatat akan dihitung di sini.</p>';
      bodyHost.innerHTML = '';
      return;
    }

    summaryHost.innerHTML =
      '<div class="metric-grid">' +
      metric(s.total, 'Total percobaan') +
      metric(s.agreeRate + '%', 'Aplikasi mendengar sama dengan penguji') +
      metric(s.appOkRate + '%', 'Aplikasi menilai tepat') +
      metric(s.childOk, 'Anak sudah benar') +
      metric(s.falseNegatives.length, 'Salah dengar') +
      metric(s.falsePositives.length, 'Lolos keliru') +
      '</div>' +
      '<p class="hint ' + (s.falseNegatives.length ? 'hint-warn' : 'hint-ok') + '" style="margin-top:10px">' +
      (s.falseNegatives.length
        ? 'Ada ' + s.falseNegatives.length + ' kejadian anak sudah mengucapkan dengan benar tetapi aplikasi menilai belum. Ini yang paling berisiko membuat anak menyerah. Rinciannya: ' +
          s.falseNegatives.map(function (t) { return escapeHtml(t.target) + ' (terdengar "' + escapeHtml(t.heard) + '")'; }).join(', ') + '.'
        : 'Belum ada kejadian anak benar tetapi dinilai salah.') +
      '</p>';

    var rows = trials.slice().reverse().map(function (t, index) {
      var flag = t.falseNegative ? badge('salah dengar', 'bad')
        : (t.falsePositive ? badge('lolos keliru', 'warn')
          : (t.appOk ? badge('tepat', 'ok') : badge('belum', 'neutral')));
      return '<tr><td>' + (trials.length - index) + '</td>' +
        '<td>' + escapeHtml(t.child || '-') + '</td>' +
        '<td><strong>' + escapeHtml(t.target) + '</strong></td>' +
        '<td>' + (t.said ? escapeHtml(t.said) : '<span class="muted">-</span>') + '</td>' +
        '<td>' + (t.heard ? escapeHtml(t.heard) : '<span class="muted">-</span>') + '</td>' +
        '<td>' + t.similarity.toFixed(2) + '</td>' +
        '<td>' + flag + '</td></tr>';
    }).join('');

    bodyHost.innerHTML = '<table class="table"><thead><tr>' +
      '<th>#</th><th>Anak</th><th>Target</th><th>Ucapan anak</th><th>Terdengar aplikasi</th><th>Mirip</th><th>Catatan</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function metric(value, label) {
    return '<div class="metric"><span class="metric-value">' + escapeHtml(value) + '</span>' +
      '<span class="metric-label">' + escapeHtml(label) + '</span></div>';
  }

  function exportTrials() {
    if (!trials.length) { log('Belum ada catatan untuk diunduh.', 'warn'); return; }
    var s = trialSummary();
    var payload = {
      app: 'wicara-phase0-trial-log',
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      threshold: (window.APP_CONFIG && APP_CONFIG.partialThreshold) || 0.6,
      summary: {
        total: s.total,
        agreeRate: s.agreeRate,
        appOkRate: s.appOkRate,
        childOk: s.childOk,
        falseNegatives: s.falseNegatives.length,
        falsePositives: s.falsePositives.length
      },
      trials: trials
    };

    download('wicara-log-uji-anak-' + Date.now() + '.json', JSON.stringify(payload, null, 2), 'application/json');

    var header = ['anak', 'target', 'ucapan_anak', 'terdengar_aplikasi', 'kemiripan', 'hasil_aplikasi', 'anak_benar', 'aplikasi_benar', 'salah_dengar', 'lolos_keliru'];
    var csv = [header.join(',')].concat(trials.map(function (t) {
      return [t.child || '', t.target, t.said, t.heard, t.similarity, t.appResult,
        t.childOk, t.appOk, t.falseNegative, t.falsePositive]
        .map(csvCell).join(',');
    })).join('\r\n');
    download('wicara-log-uji-anak-' + Date.now() + '.csv', csv, 'text/csv');
    log('Log uji diunduh sebagai JSON dan CSV.', 'ok');
  }

  function csvCell(value) {
    var text = String(value === null || value === undefined ? '' : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function download(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      log('Gagal mengunduh: ' + (e && e.message ? e.message : e), 'bad');
    }
  }

  /* ------------------------------------------------------------ 8. salinan */

  function buildReport() {
    var secure = Mic.secureContext();
    var lines = [];
    lines.push('=== LAPORAN UJI WICARA PHASE 0 ===');
    lines.push('waktu        : ' + new Date().toISOString());
    lines.push('perangkat    : ' + navigator.userAgent);
    lines.push('halaman      : ' + location.href);
    lines.push('konteks aman : ' + (secure ? 'ya' : 'TIDAK (mic dan STT akan diblokir)'));
    lines.push('');
    lines.push('--- kemampuan browser ---');
    lines.push('SpeechSynthesis      : ' + (TTS.supported ? 'ada' : 'tidak ada'));
    lines.push('suara id-ID          : ' + (TTS.supported ? TTS.idVoiceCount() : 0));
    lines.push('SpeechRecognition    : ' + (Mic.sttSupported ? (Mic.recognitionName || 'ada') : 'tidak ada'));
    lines.push('MediaRecorder        : ' + (window.MediaRecorder ? 'ada' : 'tidak ada'));
    lines.push('IndexedDB            : ' + (window.indexedDB ? 'ada' : 'tidak ada'));
    lines.push('');
    lines.push('--- uji mesin evaluasi (ambang 0.6) ---');
    var pass = 0;
    CASES.forEach(function (item) {
      var evaluation = Therapy.evaluate(item.target, item.transcript, { partialThreshold: 0.6 });
      var ok = evaluation.result === item.expect;
      if (ok) pass++;
      lines.push((ok ? 'OK   ' : 'GAGAL') + ' target=' + item.target +
        ' terdengar=' + (item.transcript || '(kosong)') +
        ' harapan=' + item.expect + ' hasil=' + evaluation.result +
        ' (' + item.note + ')');
    });
    lines.push('total lulus: ' + pass + ' / ' + CASES.length);
    lines.push('');
    lines.push('--- log uji suara anak ---');
    var s = trialSummary();
    if (!s.total) {
      lines.push('belum ada catatan');
    } else {
      lines.push('total percobaan                : ' + s.total);
      lines.push('aplikasi dengar sama dgn penguji: ' + s.agreeRate + '%');
      lines.push('aplikasi menilai tepat          : ' + s.appOkRate + '%');
      lines.push('anak sudah benar                : ' + s.childOk);
      lines.push('salah dengar (anak benar, nilai belum) : ' + s.falseNegatives.length);
      lines.push('lolos keliru (anak belum, nilai benar) : ' + s.falsePositives.length);
      lines.push('');
      trials.forEach(function (t, i) {
        lines.push('#' + (i + 1) + ' anak=' + (t.child || '-') + ' target=' + t.target +
          ' ucapan=' + (t.said || '-') + ' terdengar=' + (t.heard || '-') +
          ' mirip=' + t.similarity + ' hasil=' + t.appResult +
          (t.falseNegative ? '  <-- SALAH DENGAR' : '') +
          (t.falsePositive ? '  <-- LOLOS KELIRU' : ''));
      });
    }
    lines.push('');
    lines.push('--- log teknis ---');
    logs.forEach(function (l) { lines.push(l.at + '  ' + l.message); });
    return lines.join('\n');
  }

  function copyReport() {
    var text = buildReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        log('Semua hasil uji disalin ke clipboard.', 'ok');
        setHint('ttsStatus', $('ttsStatus') ? $('ttsStatus').textContent : '', '');
      }).catch(function () {
        download('wicara-laporan-uji-' + Date.now() + '.txt', text, 'text/plain');
        log('Clipboard diblokir, laporan diunduh sebagai file teks.', 'warn');
      });
    } else {
      download('wicara-laporan-uji-' + Date.now() + '.txt', text, 'text/plain');
      log('Clipboard tidak tersedia, laporan diunduh sebagai file teks.', 'warn');
    }
  }

  /* ---------------------------------------------------------------- init */

  function fillTargets() {
    var list = $('sttTargetList');
    if (!list || !window.EXERCISES) return;
    list.innerHTML = EXERCISES.map(function (ex) {
      return '<option value="' + escapeHtml(ex.target) + '">' + escapeHtml(ex.display) + '</option>';
    }).join('');
  }

  function watchNetwork() {
    var el = $('netPill');
    if (!el) return;
    function update() {
      el.textContent = navigator.onLine ? 'online' : 'offline';
      el.className = 'pill pill-muted' + (navigator.onLine ? '' : ' pill-offline');
    }
    update();
    window.addEventListener('online', function () { update(); renderCapabilities(); });
    window.addEventListener('offline', function () { update(); renderCapabilities(); });
  }

  function init() {
    fillTargets();
    renderCapabilities();
    renderVoices();
    onThreshold();
    runCases();
    renderTrials();
    refreshMicState();
    watchNetwork();

    if (TTS.onChange) TTS.onChange(function () { renderVoices(); renderCapabilities(); });

    $('btnRefreshVoices').addEventListener('click', renderVoices);
    $('btnSpeakTest').addEventListener('click', speakTest);
    $('btnAskMic').addEventListener('click', askMic);
    $('btnSttRecord').addEventListener('click', sttRecord);
    $('btnSttStop').addEventListener('click', function () { Mic.stop(); });
    $('btnRunCases').addEventListener('click', runCases);
    $('threshold').addEventListener('input', onThreshold);
    $('customTarget').addEventListener('input', evalCustom);
    $('customTranscript').addEventListener('input', evalCustom);
    $('btnTrialRecord').addEventListener('click', function () {
      if ($('trialTarget') && !$('trialTarget').value && $('sttTarget')) $('trialTarget').value = $('sttTarget').value;
      sttRecord();
      var wait = setInterval(function () {
        if (!recording) {
          clearInterval(wait);
          if (lastStt && lastStt.ok && $('trialHeard')) {
            $('trialHeard').value = lastStt.transcript || '';
            log('Hasil rekaman dimasukkan ke kolom "yang ditangkap aplikasi".', 'ok');
          }
        }
      }, 250);
    });
    $('btnAddTrial').addEventListener('click', addTrial);
    $('btnExportTrials').addEventListener('click', exportTrials);
    $('btnClearTrials').addEventListener('click', function () {
      if (!trials.length) return;
      if (window.confirm('Kosongkan ' + trials.length + ' catatan uji? Tindakan ini tidak bisa dibatalkan.')) {
        trials = [];
        renderTrials();
        log('Log uji dikosongkan.', 'warn');
      }
    });
    $('btnCopyLog').addEventListener('click', function () {
      var text = logs.map(function (l) { return l.at + '  ' + l.message; }).join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { log('Log disalin.', 'ok'); });
      }
    });
    $('btnCopyAll').addEventListener('click', copyReport);
    $('btnClearLog').addEventListener('click', function () {
      logs = [];
      if ($('logPanel')) $('logPanel').innerHTML = '';
    });

    log('Halaman uji dimuat.', 'ok');
    log('Konteks aman: ' + (Mic.secureContext() ? 'ya' : 'tidak - microphone dan STT akan diblokir'), Mic.secureContext() ? 'ok' : 'bad');
    if (!Mic.sttSupported) log('Browser ini tidak mendukung SpeechRecognition. Coba Chrome di Android.', 'bad');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
