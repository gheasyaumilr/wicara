/* speech.js - pembungkus SpeechSynthesis API (PRD bagian 16)
   Prioritas: voice id-ID -> voice berawalan "id" -> voice default browser.

   Catatan penting soal pemberitahuan:
   readVoices() hanya membaca dan menyimpan ke cache, tanpa memberi tahu
   pendengar. refreshVoices() yang memberi tahu. Pemisahan ini mencegah
   rekursi tak berujung ketika pendengar ikut menggambar ulang daftar suara. */
(function (global) {
  'use strict';

  var synth = global.speechSynthesis || null;
  var voices = [];
  var listeners = [];

  function lang() {
    return (global.APP_CONFIG && global.APP_CONFIG.lang) || 'id-ID';
  }

  function readVoices() {
    if (!synth) return voices;
    var next = [];
    try { next = synth.getVoices() || []; } catch (e) { next = []; }
    if (next.length) voices = next;
    return voices;
  }

  function notify() {
    var snapshot = voices.slice();
    listeners.forEach(function (fn) {
      try { fn(snapshot); } catch (e) { /* satu pendengar gagal tidak boleh menghentikan yang lain */ }
    });
  }

  function refreshVoices() {
    readVoices();
    notify();
    return voices;
  }

  function getVoices() {
    return voices.length ? voices.slice() : readVoices().slice();
  }

  function onChange(fn) {
    if (typeof fn !== 'function') return;
    listeners.push(fn);
    try { fn(getVoices()); } catch (e) { /* abaikan */ }
  }

  function pickVoice(wanted) {
    var target = String(wanted || lang()).toLowerCase().replace('_', '-');
    var list = getVoices();
    if (!list.length) return null;

    var exact = list.filter(function (v) {
      return String(v.lang || '').toLowerCase().replace('_', '-') === target;
    });
    if (exact.length) {
      var local = exact.filter(function (v) { return v.localService; });
      return local[0] || exact[0];
    }

    var prefix = target.split('-')[0];
    var near = list.filter(function (v) {
      return String(v.lang || '').toLowerCase().indexOf(prefix) === 0;
    });
    if (near.length) return near[0];

    return list.filter(function (v) { return v.default; })[0] || list[0];
  }

  function idVoiceCount() {
    return getVoices().filter(function (v) {
      return String(v.lang || '').toLowerCase().indexOf('id') === 0;
    }).length;
  }

  function speak(text, options) {
    return new Promise(function (resolve, reject) {
      if (!synth) {
        reject(new Error('Browser ini tidak mendukung SpeechSynthesis.'));
        return;
      }
      var opts = options || {};
      var value = text === null || text === undefined ? '' : String(text);
      if (!value.trim()) {
        resolve({ spoken: false, empty: true, text: value });
        return;
      }

      try { synth.cancel(); } catch (e) { /* abaikan */ }

      var utter = new SpeechSynthesisUtterance(value);
      var voice = opts.voice || pickVoice(opts.lang);
      if (voice) utter.voice = voice;
      utter.lang = opts.lang || (voice && voice.lang) || lang();
      utter.rate = typeof opts.rate === 'number'
        ? opts.rate
        : (global.APP_CONFIG && APP_CONFIG.tts ? APP_CONFIG.tts.rate : 0.85);
      utter.pitch = typeof opts.pitch === 'number'
        ? opts.pitch
        : (global.APP_CONFIG && APP_CONFIG.tts ? APP_CONFIG.tts.pitch : 1);
      utter.volume = typeof opts.volume === 'number' ? opts.volume : 1;

      var settled = false;
      var timer = null;

      function done(payload) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(payload);
      }

      utter.onend = function () {
        done({ spoken: true, text: value, voice: utter.voice ? utter.voice.name : null });
      };
      utter.onerror = function (event) {
        var code = event && event.error ? event.error : 'unknown';
        if (code === 'interrupted' || code === 'canceled') {
          done({ spoken: false, interrupted: true, text: value });
        } else {
          settled = true;
          if (timer) clearTimeout(timer);
          reject(new Error('TTS gagal: ' + code));
        }
      };

      try {
        synth.speak(utter);
      } catch (e) {
        settled = true;
        reject(new Error('TTS gagal dipanggil: ' + (e && e.message ? e.message : e)));
        return;
      }

      /* Beberapa browser tidak memicu onend (terutama iOS). Batas waktu
         mencegah alur latihan menggantung. */
      var budget = typeof opts.timeoutMs === 'number'
        ? opts.timeoutMs
        : Math.max(2500, value.length * 130 + 1200);
      timer = setTimeout(function () {
        done({ spoken: false, timedOut: true, text: value });
      }, budget);
    });
  }

  function cancel() {
    if (synth) { try { synth.cancel(); } catch (e) { /* abaikan */ } }
  }

  function speaking() {
    return synth ? !!synth.speaking : false;
  }

  function init() {
    if (!synth) return;
    readVoices();
    try { synth.addEventListener('voiceschanged', refreshVoices); } catch (e) {
      synth.onvoiceschanged = refreshVoices;
    }
  }

  init();

  global.TTS = {
    supported: !!synth,
    init: init,
    readVoices: readVoices,
    refreshVoices: refreshVoices,
    onChange: onChange,
    getVoices: getVoices,
    pickVoice: pickVoice,
    idVoiceCount: idVoiceCount,
    speak: speak,
    cancel: cancel,
    speaking: speaking
  };
})(window);
