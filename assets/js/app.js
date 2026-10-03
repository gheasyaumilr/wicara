/* app.js - alur latihan Child Mode (PRD bagian 13, 18, 19)
   Semua data sesi hanya hidup di memori dan bisa diekspor ke JSON.
   Phase 0 tidak menyimpan apa pun ke server. */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var MAX_ATTEMPTS = (global.APP_CONFIG && APP_CONFIG.maxAttempts) || 3;

  var state = {
    mode: (global.APP_CONFIG && APP_CONFIG.defaultMode) || 'auto',
    index: 0,
    attempt: 0,
    manualPromptLevel: null,
    recording: false,
    busy: false,
    sttBroken: false,
    techNotes: [],
    exerciseResults: {},
    session: {
      startedAt: null,
      endedAt: null,
      childLabel: '',
      entries: []
    }
  };

  var el = {};

  function cacheDom() {
    ['progressPill', 'netPill', 'btnParent', 'envWarning', 'stage', 'cardExercise', 'figure',
     'stimulusImage', 'targetWord', 'instructionText', 'cardSummary', 'summaryBody',
     'actions', 'btnListen', 'btnSpeak', 'btnNext', 'status', 'feedback', 'feedbackText',
     'feedbackDetail', 'parentPanel', 'parentAttempt', 'parentPromptLevel', 'parentTechnical',
     'parentLog', 'parentManualText', 'btnManualEval', 'btnExport', 'btnRestart', 'parentSttState',
     'autoBar', 'btnAutoStart', 'btnAutoPause', 'btnAutoStop', 'listenDot', 'parentMode'
    ].forEach(function (id) { el[id] = $(id); });
  }

  function current() { return global.EXERCISES[state.index]; }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function nowIso() { return new Date().toISOString(); }

  /* ---------------------------------------------------------------- tampilan */

  function setStatus(text, tone) {
    if (!el.status) return;
    el.status.textContent = text;
    el.status.className = 'status' + (tone ? ' status-' + tone : '');
  }

  function setFeedback(text, detail, tone) {
    if (!el.feedback) return;
    el.feedbackText.textContent = text || '';
    el.feedbackDetail.textContent = detail || '';
    el.feedbackDetail.hidden = !detail;
    el.feedback.className = 'feedback' + (tone ? ' feedback-' + tone : '');
    el.feedback.hidden = !text;
  }

  function clearFeedback() { setFeedback('', '', ''); }

  function render() {
    var ex = current();
    if (!ex) return;

    if (el.progressPill) {
      el.progressPill.textContent = 'Latihan ' + (state.index + 1) + ' / ' + global.EXERCISES.length;
    }
    if (el.targetWord) el.targetWord.textContent = ex.display;
    if (el.instructionText) el.instructionText.textContent = ex.instruction + '...';

    if (el.stimulusImage) {
      el.stimulusImage.alt = 'Gambar ' + ex.target;
      el.stimulusImage.hidden = false;
      el.stimulusImage.src = ex.image;
    }
    if (el.figure) el.figure.classList.remove('figure-missing');

    if (el.parentAttempt) el.parentAttempt.textContent = String(state.attempt);
    if (el.parentPromptLevel) el.parentPromptLevel.value = state.manualPromptLevel || 'auto';
    renderLog();
  }

  function renderLog() {
    if (!el.parentLog) return;
    if (!state.session.entries.length) {
      el.parentLog.innerHTML = '<p class="muted">Belum ada respons tercatat.</p>';
      return;
    }
    var rows = state.session.entries.slice().reverse().map(function (e, i) {
      var seq = state.session.entries.length - i;
      return '<tr>' +
        '<td>' + seq + '</td>' +
        '<td><strong>' + escapeHtml(e.target) + '</strong></td>' +
        '<td>' + escapeHtml(e.transcript || '-') + '</td>' +
        '<td><span class="tag tag-' + e.evaluation.toLowerCase() + '">' + e.evaluation + '</span></td>' +
        '<td>' + e.promptLevel + '</td>' +
        '<td class="muted">' + e.responseType + '</td>' +
        '</tr>';
    }).join('');
    el.parentLog.innerHTML =
      '<table class="table"><thead><tr>' +
      '<th>#</th><th>Target</th><th>Terdengar</th><th>Hasil</th><th>Prompt</th><th>Tipe</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setBusy(flag) {
    state.busy = flag;
    if (el.btnListen) el.btnListen.disabled = flag;
    if (el.btnSpeak) el.btnSpeak.disabled = flag;
  }

  /* ------------------------------------------------------------------- suara */

  /* Membacakan prompt lalu instruksi. Tidak menyentuh tombol dan tidak
     menetapkan status akhir - pemanggil yang mengatur itu, karena alur
     tombol dan alur otomatis memakai kalimat yang berbeda.

     Urutannya penting untuk pengamanan gema: fungsi ini baru selesai
     setelah audio benar-benar berhenti, sehingga pemanggil bisa menunggu
     jeda tambahan sebelum membuka mikrofon. */
  async function bacakanPrompt(ex) {
    if (!global.TTS || !TTS.supported) {
      noteTechnical('SpeechSynthesis tidak tersedia. Instruksi audio dilewati.');
      return { spoken: false, reason: 'tanpa-tts' };
    }
    var rate = (APP_CONFIG.tts && APP_CONFIG.tts.rate) || 0.85;
    try {
      await TTS.speak(ex.prompt, { rate: rate });
      await wait((global.APP_CONFIG && APP_CONFIG.pauseBetweenPromptsMs) || 450);
      await TTS.speak(ex.instruction, { rate: rate });
      return { spoken: true };
    } catch (error) {
      noteTechnical('TTS: ' + (error && error.message ? error.message : error));
      return { spoken: false, reason: 'galat' };
    }
  }

  async function playPrompt() {
    var ex = current();
    if (!ex) return;
    if (!global.TTS || !TTS.supported) {
      await bacakanPrompt(ex);
      setStatus('Audio tidak tersedia di browser ini. Tekan "Saya coba" ya.', 'warn');
      return;
    }
    setBusy(true);
    clearFeedback();
    try {
      setStatus('Dengarkan...', 'live');
      var hasil = await bacakanPrompt(ex);
      setStatus(
        hasil.spoken ? 'Sekarang tekan "Saya coba" ya.' : 'Audio sedang tidak bisa diputar. Tetap bisa lanjut latihan.',
        hasil.spoken ? 'ready' : 'warn'
      );
    } finally {
      setBusy(false);
    }
  }

  /* Membuka mikrofon satu kali dan mengembalikan hasilnya. Dipakai alur
     otomatis. Alur tombol tetap memakai startRecording() karena perlu
     mengurus tombol dan keadaan sibuk. */
  async function dengarSekali(opsi) {
    var opts = opsi || {};
    if (!global.Mic || !Mic.sttSupported) {
      state.sttBroken = true;
      updateSttState();
      noteTechnical('SpeechRecognition tidak didukung browser ini.');
      return { ok: false, error: 'unsupported', message: 'SpeechRecognition tidak didukung browser ini.' };
    }
    var timeout = typeof opts.timeoutMs === 'number'
      ? opts.timeoutMs
      : ((APP_CONFIG.stt && APP_CONFIG.stt.timeoutMs) || 6000);
    var hasil;
    try {
      hasil = await Mic.listen({
        timeoutMs: timeout,
        onInterim: opts.onInterim,
        onSpeechStart: opts.onSpeechStart
      });
    } catch (error) {
      return { ok: false, error: 'exception', message: error && error.message ? error.message : String(error) };
    }
    if (!hasil || !hasil.ok) {
      state.sttBroken = true;
      updateSttState();
      noteTechnical((hasil && hasil.message) || 'Pengenalan suara gagal.');
    }
    return hasil || { ok: false, error: 'kosong', message: 'Pengenalan suara tidak mengembalikan hasil.' };
  }

  async function startRecording() {
    if (state.recording) {
      if (global.Mic) Mic.stop();
      return;
    }
    if (state.busy) return;

    clearFeedback();
    if (el.btnNext) el.btnNext.hidden = true;
    state.recording = true;
    el.btnSpeak.classList.add('is-recording');
    setStatus('Mendengarkan...', 'live');

    if (!global.Mic || !Mic.sttSupported) {
      state.recording = false;
      el.btnSpeak.classList.remove('is-recording');
      state.sttBroken = true;
      noteTechnical('SpeechRecognition tidak didukung browser ini.');
      updateSttState();
      /* Anak tidak boleh terhenti di sini. Tanpa pengenalan suara, hasil
         diisi lewat Mode Orang Tua - tetapi tombol Lanjut tetap dibuka
         supaya latihan bisa diteruskan (PRD Prinsip 7 "Fail Gracefully").
         Tidak ada catatan respons yang dibuat: alat yang tidak bisa merekam
         bukan NO_RESPONSE, dan mencatatnya akan merusak angka accuracy. */
      setStatus('Suara belum bisa direkam di perangkat ini. Tekan "Lanjut" ya.', 'warn');
      if (el.btnNext) el.btnNext.hidden = false;
      return;
    }

    var timeout = (global.APP_CONFIG && APP_CONFIG.stt && APP_CONFIG.stt.timeoutMs) || 6000;
    var result;
    try {
      result = await Mic.listen({
        timeoutMs: timeout,
        onInterim: function (text) {
          if (text) setStatus('Mendengarkan... "' + text + '"', 'live');
        },
        onSpeechStart: function () { setStatus('Mendengarkan...', 'live'); }
      });
    } catch (error) {
      result = { ok: false, error: 'exception', message: error && error.message ? error.message : String(error) };
    }

    state.recording = false;
    el.btnSpeak.classList.remove('is-recording');

    if (!result || !result.ok) {
      state.sttBroken = true;
      updateSttState();
      noteTechnical((result && result.message) || 'Pengenalan suara gagal.');
      setStatus('Suara belum terbaca. Tekan "Orang tua" untuk mengisi manual.', 'warn');
      /* Anak tidak pernah melihat pesan teknis (PRD US-018). */
      setFeedback('Ayo coba lagi', 'Tekan tombol hijau sekali lagi ya.', 'warn');
      if (el.btnNext) el.btnNext.hidden = false;
      return;
    }

    handleTranscript(result.transcript, result);
  }

  function handleTranscript(transcript, meta) {
    var ex = current();
    var attempt = state.attempt + 1;
    var evaluation = Therapy.evaluate(ex.target, transcript);
    var promptLevel = Therapy.derivePromptLevel(attempt, state.manualPromptLevel);
    var responseType = Therapy.deriveResponseType(evaluation, attempt, promptLevel);

    state.attempt = attempt;

    var entry = {
      at: nowIso(),
      exerciseId: ex.id,
      target: ex.target,
      display: ex.display,
      attempt: attempt,
      transcript: transcript,
      alternatives: (meta && meta.alternatives) || [],
      evaluation: evaluation.result,
      reason: evaluation.reason,
      similarity: evaluation.similarity,
      promptLevel: promptLevel,
      responseType: responseType,
      success: Therapy.isCorrect(evaluation.result),
      durationMs: (meta && meta.durationMs) || null,
      /* 'stt' = tombol Saya coba, 'auto' = alur otomatis, 'manual' = diisi
         orang tua. Berguna saat menafsirkan hasil ekspor. */
      source: (meta && meta.source) || 'stt'
    };
    state.session.entries.push(entry);
    if (!state.session.startedAt) state.session.startedAt = entry.at;

    if (state.exerciseResults[ex.id] === undefined || entry.success) {
      state.exerciseResults[ex.id] = state.exerciseResults[ex.id] || entry.success;
    }
    if (entry.success) state.exerciseResults[ex.id] = true;

    showVerdict(entry);
    renderLog();
    updateParentInfo();

    if (el.btnNext) el.btnNext.hidden = false;
    if (el.parentManualText) el.parentManualText.value = '';
  }

  function showVerdict(entry) {
    var heard = entry.transcript ? 'Terdengar: "' + entry.transcript + '"' : 'Tidak ada suara yang terbaca.';
    if (entry.evaluation === Therapy.RESULT.MATCH) {
      setFeedback('Bagus!', heard, 'good');
      setStatus('Bagus! Tekan Lanjut ya.', 'ready');
    } else if (entry.evaluation === Therapy.RESULT.PARTIAL_MATCH) {
      setFeedback('Hampir!', heard, 'warn');
      setStatus(state.attempt < MAX_ATTEMPTS ? 'Ayo coba sekali lagi.' : 'Tekan Lanjut ya.', 'warn');
    } else {
      setFeedback('Ayo coba lagi', heard, 'warn');
      setStatus(state.attempt < MAX_ATTEMPTS ? 'Ayo coba sekali lagi.' : 'Tekan Lanjut ya.', 'warn');
    }
  }

  function nextExercise() {
    if (state.index < global.EXERCISES.length - 1) {
      state.index += 1;
      state.attempt = 0;
      state.manualPromptLevel = null;
      clearFeedback();
      if (el.btnNext) el.btnNext.hidden = true;
      render();
      setStatus('Tekan Dengarkan dulu ya.', 'ready');
      updateParentInfo();
    } else {
      finishSession();
    }
  }

  /* ---------------------------------------------------------------- ringkasan */

  function summarize() {
    var entries = state.session.entries;
    var total = entries.length;
    var match = entries.filter(function (e) { return e.evaluation === 'MATCH'; }).length;
    var partial = entries.filter(function (e) { return e.evaluation === 'PARTIAL_MATCH'; }).length;
    var noMatch = entries.filter(function (e) { return e.evaluation === 'NO_MATCH'; }).length;
    var noResponse = entries.filter(function (e) { return e.evaluation === 'NO_RESPONSE'; }).length;
    var independent = entries.filter(function (e) {
      return e.evaluation === 'MATCH' && e.responseType === 'INDEPENDENT';
    }).length;
    var prompted = entries.filter(function (e) { return e.responseType === 'PROMPTED'; }).length;
    var approximation = entries.filter(function (e) { return e.responseType === 'APPROXIMATION'; }).length;

    var exercisesDone = Object.keys(state.exerciseResults).length;
    var exercisesMastered = Object.keys(state.exerciseResults).filter(function (k) {
      return state.exerciseResults[k] === true;
    }).length;

    return {
      opportunities: total,
      match: match,
      partialMatch: partial,
      noMatch: noMatch,
      noResponse: noResponse,
      independent: independent,
      prompted: prompted,
      approximation: approximation,
      accuracy: total ? Number(((match / total) * 100).toFixed(1)) : 0,
      independence: total ? Number(((independent / total) * 100).toFixed(1)) : 0,
      exercisesAttempted: exercisesDone,
      exercisesMatched: exercisesMastered
    };
  }

  function finishSession() {
    state.session.endedAt = nowIso();
    var summary = summarize();
    state.session.summary = summary;

    if (el.cardExercise) el.cardExercise.hidden = true;
    if (el.actions) el.actions.hidden = true;
    if (el.cardSummary) el.cardSummary.hidden = false;
    clearFeedback();

    var durationSec = state.session.startedAt
      ? Math.round((new Date(state.session.endedAt) - new Date(state.session.startedAt)) / 1000)
      : 0;

    if (el.summaryBody) {
      el.summaryBody.innerHTML =
        '<div class="metric-grid">' +
        metric('Latihan selesai', summary.exercisesAttempted + ' / ' + global.EXERCISES.length) +
        metric('Total percobaan', summary.opportunities) +
        metric('Tepat', summary.match) +
        metric('Hampir', summary.partialMatch) +
        metric('Belum sesuai', summary.noMatch + summary.noResponse) +
        metric('Accuracy', summary.accuracy + '%') +
        metric('Independence', summary.independence + '%') +
        metric('Durasi', durationSec + ' detik') +
        '</div>' +
        '<p class="disclaimer">Angka di atas adalah catatan latihan, bukan penilaian klinis. ' +
        'Interpretasi tetap dilakukan oleh tenaga profesional.</p>';
    }

    setStatus('Latihan selesai. Terima kasih sudah berlatih!', 'ready');
    updateParentInfo();
  }

  function metric(label, value) {
    return '<div class="metric"><span class="metric-value">' + escapeHtml(value) + '</span>' +
      '<span class="metric-label">' + escapeHtml(label) + '</span></div>';
  }

  /* ------------------------------------------------------------ orang tua */

  /* Catatan teknis disimpan sebagai daftar, bukan satu slot. Sebelumnya
     catatan terakhir dihapus begitu ada respons yang berhasil, sehingga
     masalah seperti "audio tidak tersedia" lenyap dari panel orang tua
     padahal seluruh sesi itu memang berjalan tanpa audio - dan data yang
     diekspor jadi tidak bisa ditafsirkan dengan benar. */
  function noteTechnical(message) {
    var isi = String(message || '').trim();
    if (!isi) return;
    var terakhir = state.techNotes[state.techNotes.length - 1];
    if (!terakhir || terakhir.message !== isi) {
      state.techNotes.push({ at: nowIso(), message: isi });
      if (state.techNotes.length > 8) state.techNotes.shift();
    }
    updateParentInfo();
  }

  function updateSttState() {
    if (!el.parentSttState) return;
    var supported = global.Mic && Mic.sttSupported;
    var text = supported
      ? (state.sttBroken ? 'Pengenalan suara bermasalah pada sesi ini.' : 'Pengenalan suara siap.')
      : 'Browser ini tidak mendukung pengenalan suara. Gunakan input manual.';
    el.parentSttState.textContent = text;
    el.parentSttState.className = 'hint ' + (supported && !state.sttBroken ? 'hint-ok' : 'hint-warn');
  }

  function updateParentInfo() {
    if (el.parentAttempt) el.parentAttempt.textContent = String(state.attempt);
    if (el.parentTechnical) {
      var catatan = state.techNotes;
      if (!catatan.length) {
        el.parentTechnical.textContent = 'Tidak ada masalah teknis.';
        el.parentTechnical.className = 'hint hint-ok';
      } else {
        var tambahan = catatan.length > 1 ? ' (+' + (catatan.length - 1) + ' catatan sebelumnya)' : '';
        el.parentTechnical.textContent = catatan[catatan.length - 1].message + tambahan;
        el.parentTechnical.className = 'hint hint-warn';
      }
    }
    updateSttState();
  }

  function toggleParent() {
    if (!el.parentPanel) return;
    var show = el.parentPanel.hidden;
    el.parentPanel.hidden = !show;
    if (el.btnParent) el.btnParent.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) el.parentPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function manualEvaluate() {
    var text = el.parentManualText ? el.parentManualText.value : '';
    if (!String(text).trim()) {
      noteTechnical('Isi dulu teks hasil pengamatan sebelum menekan Nilai.');
      return;
    }
    handleTranscript(String(text), { alternatives: [], durationMs: null });
    var last = state.session.entries[state.session.entries.length - 1];
    if (last) last.source = 'manual';
  }

  /* --------------------------------------------------------------- ekspor */

  function buildExport() {
    return {
      app: 'wicara-phase0',
      exportedAt: nowIso(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      secureContext: global.Mic ? Mic.secureContext() : null,
      /* Mode ikut dicatat: sesi otomatis dan sesi tombol tidak boleh
         ditafsirkan sama, karena jumlah bantuan orang dewasa berbeda. */
      mode: state.mode,
      config: {
        lang: global.APP_CONFIG.lang,
        partialThreshold: global.APP_CONFIG.partialThreshold,
        maxAttempts: MAX_ATTEMPTS
      },
      capabilities: {
        speechSynthesis: !!(global.TTS && TTS.supported),
        idVoiceCount: global.TTS ? TTS.idVoiceCount() : 0,
        speechRecognition: !!(global.Mic && Mic.sttSupported),
        recognitionName: global.Mic ? Mic.recognitionName : null,
        mediaRecorder: !!(global.Mic && Mic.mediaRecorderSupported)
      },
      /* Masalah teknis selama sesi ikut diekspor: sesi yang berjalan tanpa
         audio atau tanpa pengenalan suara tidak boleh ditafsirkan sama
         dengan sesi yang berjalan normal. */
      technical: state.techNotes.slice(),
      session: {
        startedAt: state.session.startedAt,
        endedAt: state.session.endedAt,
        childLabel: state.session.childLabel,
        summary: state.session.summary || summarize(),
        entries: state.session.entries
      }
    };
  }

  function exportSession() {
    var payload = buildExport();
    var text = JSON.stringify(payload, null, 2);
    download('wicara-phase0-session-' + Date.now() + '.json', text, 'application/json');
    copyText(text).then(function (ok) {
      noteTechnical(ok ? 'Hasil sesi disalin ke clipboard dan diunduh.' : 'Hasil sesi diunduh sebagai file JSON.');
    });
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
      noteTechnical('Gagal mengunduh: ' + (e && e.message ? e.message : e));
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function restart() {
    state.index = 0;
    state.attempt = 0;
    state.manualPromptLevel = null;
    state.sttBroken = false;
    state.techNotes = [];
    state.exerciseResults = {};
    state.session = { startedAt: null, endedAt: null, childLabel: '', entries: [] };

    if (el.cardExercise) el.cardExercise.hidden = false;
    if (el.cardSummary) el.cardSummary.hidden = true;
    if (el.btnNext) el.btnNext.hidden = true;
    if (el.parentManualText) el.parentManualText.value = '';

    render();
    applyMode();
    clearFeedback();
    setStatus(state.mode === MODE_AUTO
      ? 'Tekan "Mulai" untuk memulai latihan.'
      : 'Tekan Dengarkan dulu ya.', 'ready');
    updateParentInfo();
  }

  /* ------------------------------------------------------ lingkungan & init */

  function checkEnvironment() {
    if (!el.envWarning) return;
    var problems = [];
    if (!global.Mic || !Mic.secureContext()) {
      problems.push('Halaman ini tidak berjalan di https atau localhost, jadi microphone dan pengenalan suara akan diblokir.');
    }
    if (!global.Mic || !Mic.sttSupported) {
      problems.push('Browser ini tidak mendukung pengenalan suara. Gunakan Chrome di Android untuk mencoba alur lengkap, atau isi hasil lewat Mode Orang Tua.');
    }
    if (global.TTS && TTS.supported && TTS.idVoiceCount() === 0) {
      problems.push('Belum ada suara bahasa Indonesia yang terpasang. Instruksi akan dibacakan dengan suara default.');
    }
    if (problems.length) {
      el.envWarning.hidden = false;
      el.envWarning.innerHTML = '<strong>Catatan untuk penguji</strong><ul>' +
        problems.map(function (p) { return '<li>' + escapeHtml(p) + '</li>'; }).join('') + '</ul>';
    } else {
      el.envWarning.hidden = true;
    }
  }

  function watchNetwork() {
    if (!el.netPill) return;
    function update() {
      var online = navigator.onLine;
      el.netPill.textContent = online ? 'online' : 'offline';
      el.netPill.className = 'pill pill-muted' + (online ? '' : ' pill-offline');
    }
    update();
    global.addEventListener('online', update);
    global.addEventListener('offline', update);
  }

  /* ------------------------------------------------------------------ mode */

  var MODE_AUTO = 'auto';
  var MODE_TOMBOL = 'tombol';

  /* Satu-satunya tempat yang boleh mengubah tampilan tombol besar. Kalau
     alur otomatis dan alur tombol masing-masing menyembunyikan tombolnya
     sendiri, keduanya akan saling menimpa. */
  function applyMode() {
    var otomatis = state.mode === MODE_AUTO;
    if (el.actions) el.actions.hidden = otomatis;
    if (el.autoBar) el.autoBar.hidden = !otomatis;
    if (el.parentMode) el.parentMode.value = state.mode;
    document.body.className = 'page-child mode-' + state.mode;
  }

  function setMode(mode) {
    var berikut = mode === MODE_TOMBOL ? MODE_TOMBOL : MODE_AUTO;
    if (berikut !== state.mode && global.Auto && global.Auto.stop) global.Auto.stop();
    state.mode = berikut;
    state.recording = false;
    state.busy = false;
    if (el.btnSpeak) el.btnSpeak.classList.remove('is-recording');
    if (el.btnNext) el.btnNext.hidden = true;
    applyMode();
    clearFeedback();
    setStatus(berikut === MODE_AUTO
      ? 'Tekan "Mulai" untuk memulai latihan.'
      : 'Tekan Dengarkan dulu ya.', 'ready');
    updateParentInfo();
    return berikut;
  }

  function bind() {
    if (el.btnListen) el.btnListen.addEventListener('click', playPrompt);
    if (el.btnSpeak) el.btnSpeak.addEventListener('click', startRecording);
    if (el.btnNext) el.btnNext.addEventListener('click', nextExercise);
    if (el.btnParent) el.btnParent.addEventListener('click', toggleParent);
    if (el.btnManualEval) el.btnManualEval.addEventListener('click', manualEvaluate);
    if (el.btnExport) el.btnExport.addEventListener('click', exportSession);
    if (el.btnRestart) el.btnRestart.addEventListener('click', restart);
    if (el.parentMode) {
      el.parentMode.addEventListener('change', function () { setMode(this.value); });
    }
    if (el.parentPromptLevel) {
      el.parentPromptLevel.addEventListener('change', function () {
        state.manualPromptLevel = this.value === 'auto' ? null : this.value;
        updateParentInfo();
      });
    }
    if (el.stimulusImage) {
      el.stimulusImage.addEventListener('error', function () {
        this.hidden = true;
        if (el.figure) el.figure.classList.add('figure-missing');
        noteTechnical('Gambar ' + (current() ? current().image : '') + ' gagal dimuat.');
      });
    }
    /* Space = Dengarkan, Enter = Saya coba. Membantu pengujian di desktop.
       Dimatikan di mode otomatis: di sana tidak ada tombol untuk anak, dan
       tombol besar yang tidak terlihat tidak boleh tetap bisa terpicu. */
    document.addEventListener('keydown', function (event) {
      if (state.mode === MODE_AUTO) return;
      if (event.target && /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.code === 'Space') { event.preventDefault(); playPrompt(); }
      if (event.code === 'Enter') { event.preventDefault(); startRecording(); }
    });
  }

  /* Mode bisa dipaksa lewat alamat, misalnya ?mode=tombol. Berguna untuk
     pengujian dan untuk menyimpan pintasan di layar utama tablet. */
  function bacaModeDariAlamat() {
    try {
      var cocok = /[?&]mode=(auto|tombol)\b/.exec(global.location.search || '');
      return cocok ? cocok[1] : null;
    } catch (e) {
      return null;
    }
  }

  function init() {
    cacheDom();
    bind();
    var dariAlamat = bacaModeDariAlamat();
    if (dariAlamat) state.mode = dariAlamat;
    render();
    applyMode();
    setStatus(state.mode === MODE_AUTO
      ? 'Tekan "Mulai" untuk memulai latihan.'
      : 'Tekan Dengarkan dulu ya.', 'ready');
    updateParentInfo();
    watchNetwork();
    if (global.TTS && TTS.onChange) TTS.onChange(function () { checkEnvironment(); });
    setTimeout(checkEnvironment, 400);
  }

  /* Permukaan yang dipakai auto.js. Sengaja sempit - hanya yang benar-benar
     dibutuhkan alur otomatis - supaya alur tombol tetap pemilik sisanya dan
     mesin evaluasi, ringkasan, serta ekspor tidak pernah diduplikasi. */
  global.App = {
    MODE_AUTO: MODE_AUTO,
    MODE_TOMBOL: MODE_TOMBOL,
    state: state,
    current: current,
    setMode: setMode,
    applyMode: applyMode,
    setStatus: setStatus,
    setFeedback: setFeedback,
    clearFeedback: clearFeedback,
    noteTechnical: noteTechnical,
    updateParentInfo: updateParentInfo,
    render: render,
    renderLog: renderLog,
    bacakanPrompt: bacakanPrompt,
    dengarSekali: dengarSekali,
    catatRespons: handleTranscript,
    lanjutLatihan: nextExercise,
    ringkas: summarize,
    buildExport: buildExport,
    mulaiUlang: restart,
    maxAttempts: MAX_ATTEMPTS
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
