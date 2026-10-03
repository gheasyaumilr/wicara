/* microphone.js - izin microphone dan Speech-to-Text (PRD bagian 14 & 15)
 *
 * Catatan penting soal browser:
 *  - SpeechRecognition butuh secure context (https atau localhost) dan, di Chrome,
 *    koneksi internet karena pengenalan diproses di server Google.
 *  - Firefox tidak mendukung SpeechRecognition sama sekali.
 *  - Safari iOS memakai mesin dikte Siri; hasilnya sering berbeda dari Chrome.
 *  Itulah sebabnya capability detection wajib dan fallback harus selalu tersedia.
 */
(function (global) {
  'use strict';

  var Recognition = global.SpeechRecognition || global.webkitSpeechRecognition || null;
  var current = null;

  function lang() {
    return (global.APP_CONFIG && global.APP_CONFIG.lang) || 'id-ID';
  }

  function isSecureContext() {
    return global.isSecureContext === true ||
      global.location.protocol === 'https:' ||
      global.location.hostname === 'localhost' ||
      global.location.hostname === '127.0.0.1';
  }

  function hasGetUserMedia() {
    return !!(global.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function requestStream(constraints) {
    if (!hasGetUserMedia()) {
      return Promise.reject(new Error('getUserMedia tidak tersedia. Halaman harus dibuka lewat https atau localhost.'));
    }
    return navigator.mediaDevices.getUserMedia(constraints || { audio: true });
  }

  function describeStream(stream) {
    var tracks = stream.getAudioTracks();
    return tracks.map(function (track) {
      var settings = {};
      try { settings = track.getSettings ? track.getSettings() : {}; } catch (e) { settings = {}; }
      return {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        sampleRate: settings.sampleRate || null,
        channelCount: settings.channelCount || null
      };
    });
  }

  /* Minta izin microphone sekali, lalu lepaskan perangkatnya. */
  function requestPermission() {
    return requestStream({ audio: true }).then(function (stream) {
      var tracks = describeStream(stream);
      stream.getTracks().forEach(function (t) { t.stop(); });
      return { granted: true, tracks: tracks };
    }).catch(function (error) {
      var name = error && error.name ? error.name : 'Error';
      var message = {
        NotAllowedError: 'Izin microphone ditolak. Buka pengaturan situs lalu izinkan Microphone.',
        PermissionDeniedError: 'Izin microphone ditolak.',
        NotFoundError: 'Tidak ada microphone yang terdeteksi.',
        DevicesNotFoundError: 'Tidak ada microphone yang terdeteksi.',
        NotReadableError: 'Microphone sedang dipakai aplikasi lain.',
        TrackStartError: 'Microphone tidak dapat dimulai.',
        SecurityError: 'Diblokir karena halaman bukan https/localhost.'
      }[name] || ('Gagal mengakses microphone: ' + name);
      return { granted: false, error: name, message: message };
    });
  }

  function permissionState() {
    if (!global.navigator || !navigator.permissions || !navigator.permissions.query) {
      return Promise.resolve('unknown');
    }
    return navigator.permissions.query({ name: 'microphone' })
      .then(function (status) { return status.state; })
      .catch(function () { return 'unknown'; });
  }

  /* Dengarkan satu ucapan lalu kembalikan hasilnya.
     Mengembalikan Promise, dan menyediakan penghenti lewat opts.onReady. */
  function listen(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      if (!Recognition) {
        resolve({
          ok: false,
          error: 'unsupported',
          message: 'Browser ini tidak mendukung pengenalan suara. Gunakan Chrome di Android, atau masukkan hasil secara manual.'
        });
        return;
      }
      if (!isSecureContext()) {
        resolve({
          ok: false,
          error: 'insecure-context',
          message: 'Pengenalan suara butuh https atau localhost.'
        });
        return;
      }

      var recog;
      try {
        recog = new Recognition();
      } catch (e) {
        resolve({ ok: false, error: 'init', message: 'Gagal menyiapkan pengenalan suara: ' + (e && e.message ? e.message : e) });
        return;
      }

      var sttCfg = (global.APP_CONFIG && APP_CONFIG.stt) || {};
      recog.lang = opts.lang || lang();
      recog.continuous = typeof opts.continuous === 'boolean' ? opts.continuous : !!sttCfg.continuous;
      recog.interimResults = true;
      recog.maxAlternatives = typeof opts.maxAlternatives === 'number' ? opts.maxAlternatives : (sttCfg.maxAlternatives || 3);

      var startedAt = Date.now();
      var finalText = '';
      var alternatives = [];
      var settled = false;
      var timer = null;

      function finish(payload) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        current = null;
        try { recog.abort(); } catch (e) { /* abaikan */ }
        var merged = {
          ok: true,
          lang: recog.lang,
          durationMs: Date.now() - startedAt,
          transcript: finalText.trim(),
          alternatives: alternatives
        };
        Object.keys(payload || {}).forEach(function (k) { merged[k] = payload[k]; });
        resolve(merged);
      }

      /* Semua penanganan diperiksa dengan `settled`. Tanpa itu, peristiwa
         susulan dari pengenal suara - misalnya onresult yang telat setelah
         pengguna menekan Jeda - masih memanggil balik pemanggil dan bisa
         menimpa tampilan yang sudah benar. */
      recog.onstart = function () {
        if (settled) return;
        if (typeof opts.onStart === 'function') opts.onStart();
      };

      recog.onaudiostart = function () {
        if (settled) return;
        if (typeof opts.onAudioStart === 'function') opts.onAudioStart();
      };

      recog.onspeechstart = function () {
        if (settled) return;
        if (typeof opts.onSpeechStart === 'function') opts.onSpeechStart();
      };

      recog.onresult = function (event) {
        if (settled) return;
        var interim = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var res = event.results[i];
          if (res.isFinal) {
            finalText += res[0].transcript;
            for (var k = 0; k < res.length; k++) {
              alternatives.push({
                transcript: String(res[k].transcript || '').trim(),
                confidence: typeof res[k].confidence === 'number' && res[k].confidence > 0
                  ? Number(res[k].confidence.toFixed(3))
                  : null
              });
            }
          } else {
            interim += res[0].transcript;
          }
        }
        if (typeof opts.onInterim === 'function') opts.onInterim(interim);
        if (finalText.trim()) {
          if (typeof opts.onFinal === 'function') opts.onFinal(finalText.trim());
          if (!recog.continuous) finish();
        }
      };

      recog.onerror = function (event) {
        if (settled) return;
        var code = event && event.error ? event.error : 'unknown';
        var friendly = {
          'not-allowed': 'Izin microphone ditolak.',
          'service-not-allowed': 'Layanan pengenalan suara diblokir browser.',
          'no-speech': 'Tidak ada suara yang terdeteksi.',
          'audio-capture': 'Microphone tidak terdeteksi.',
          'network': 'Pengenalan suara butuh koneksi internet.',
          'aborted': 'Pengenalan suara dihentikan.'
        }[code] || ('Pengenalan suara gagal: ' + code);
        finish({ ok: false, error: code, message: friendly, transcript: finalText.trim(), alternatives: alternatives });
      };

      recog.onend = function () {
        if (settled) return;
        finish({ ended: true });
      };

      var controller = {
        stop: function () { finish({ stoppedByUser: true }); },
        recognition: recog
      };
      current = controller;

      try {
        recog.start();
      } catch (e) {
        settled = true;
        current = null;
        resolve({ ok: false, error: 'start', message: 'Pengenalan suara tidak dapat dimulai: ' + (e && e.message ? e.message : e) });
        return;
      }

      if (typeof opts.onReady === 'function') opts.onReady(controller);

      var budget = typeof opts.timeoutMs === 'number'
        ? opts.timeoutMs
        : (sttCfg.timeoutMs || 6000);
      if (budget > 0) {
        timer = setTimeout(function () { finish({ timedOut: true }); }, budget);
      }
    });
  }

  function stop() {
    if (current) current.stop();
  }

  /* Perekam audio lokal. Dipakai halaman uji untuk mengukur durasi bicara.
     Audio tidak diunggah dan tidak disimpan permanen (PRD bagian 25). */
  function createRecorder(stream) {
    if (!global.MediaRecorder) return null;
    var chunks = [];
    var recorder = new MediaRecorder(stream);
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    return {
      recorder: recorder,
      start: function () { chunks = []; recorder.start(); },
      stop: function () {
        return new Promise(function (resolve) {
          recorder.onstop = function () {
            var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            resolve({ blob: blob, url: URL.createObjectURL(blob), bytes: blob.size });
          };
          try { recorder.stop(); } catch (e) { resolve({ blob: null, url: null, bytes: 0 }); }
        });
      }
    };
  }

  global.Mic = {
    sttSupported: !!Recognition,
    recognitionName: Recognition ? (Recognition.name || 'SpeechRecognition') : null,
    mediaRecorderSupported: !!global.MediaRecorder,
    secureContext: isSecureContext,
    hasGetUserMedia: hasGetUserMedia,
    requestPermission: requestPermission,
    permissionState: permissionState,
    listen: listen,
    stop: stop,
    createRecorder: createRecorder
  };
})(window);
