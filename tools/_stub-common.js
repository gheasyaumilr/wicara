/* tools/_stub-common.js - inti tiruan API browser, dipakai bersama oleh
   _ui-stub.js (alur normal) dan _fail-stub.js (jalur kegagalan).

   PENTING: window.speechSynthesis bersifat readonly di Chrome. Menulis
   `window.speechSynthesis = {...}` akan melempar TypeError pada mode strict
   dan tiruan gagal terpasang tanpa suara. Karena itu yang ditambal adalah
   method-nya, bukan objeknya. Hal yang sama berlaku untuk SpeechRecognition:
   prototipenya yang ditambal, bukan konstruktornya.

   Selain itu Chrome memvalidasi tipe pada `utter.voice`, sehingga objek biasa
   ditolak. Penyetelnya karena itu diganti lewat defineProperty. */
window.__buatTiruan = function (opsi) {
  'use strict';

  var o = opsi || {};

  var state = {
    mode: o.mode || 'queue',        // 'queue' = pakai daftar, 'echo' = tirukan kata di layar
    queue: (o.queue || []).slice(),
    sttError: o.sttError || null,   // misalnya 'not-allowed', 'network', 'no-speech'
    spoken: [],
    sttStartCount: 0,
    sttAbortCount: 0,
    terpasang: {},
    error: null
  };

  function catat(nama, fn) {
    try { fn(); state.terpasang[nama] = true; }
    catch (e) {
      state.terpasang[nama] = false;
      state.error = nama + ': ' + (e && e.message ? e.message : e);
    }
  }

  /* ------------------------------------------------------------------ TTS */

  var voices = [
    { name: 'Stub Suara Indonesia', lang: 'id-ID', localService: true, default: false },
    { name: 'Stub Suara Inggris', lang: 'en-US', localService: true, default: false }
  ];

  if (o.tanpaTts) {
    catat('tanpaTts', function () {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
      if (window.speechSynthesis) throw new Error('speechSynthesis masih ada');
    });
  } else {
    catat('speechSynthesis', function () {
      var synth = window.speechSynthesis;
      if (!synth) throw new Error('speechSynthesis tidak ada');

      synth.getVoices = function () { return voices; };
      synth.addEventListener = function () {};
      synth.removeEventListener = function () {};
      synth.cancel = function () {};
      synth.speak = function (utter) {
        state.spoken.push(String(utter && utter.text || ''));
        setTimeout(function () {
          if (utter && typeof utter.onend === 'function') utter.onend();
        }, 5);
      };
    });

    catat('utteranceVoice', function () {
      var proto = window.SpeechSynthesisUtterance && window.SpeechSynthesisUtterance.prototype;
      if (!proto) throw new Error('SpeechSynthesisUtterance tidak ada');
      Object.defineProperty(proto, 'voice', {
        configurable: true,
        enumerable: true,
        get: function () { return this.__voiceTiruan || null; },
        set: function (nilai) { this.__voiceTiruan = nilai; }
      });
    });
  }

  /* ------------------------------------------------------------------ STT */

  if (o.tanpaStt) {
    catat('tanpaStt', function () {
      Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: undefined });
      Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        throw new Error('SpeechRecognition masih ada');
      }
    });
  } else {
    catat('speechRecognition', function () {
      var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec || !Rec.prototype) throw new Error('SpeechRecognition tidak ada');

      Rec.prototype.start = function () {
        var self = this;
        state.sttStartCount++;

        setTimeout(function () {
          if (typeof self.onstart === 'function') self.onstart();
          if (typeof self.onaudiostart === 'function') self.onaudiostart();

          if (state.sttError) {
            setTimeout(function () {
              if (typeof self.onerror === 'function') self.onerror({ error: state.sttError });
            }, 10);
            return;
          }

          if (typeof self.onspeechstart === 'function') self.onspeechstart();

          setTimeout(function () {
            var text = state.mode === 'echo'
              ? kataTargetDiLayar()
              : (state.queue.length ? state.queue.shift() : '');

            if (text) {
              var alternatif = [{ transcript: text, confidence: 0.91 }];
              alternatif.isFinal = true;
              var hasil = [alternatif];
              hasil.isFinal = true;
              if (typeof self.onresult === 'function') {
                self.onresult({ resultIndex: 0, results: hasil });
              }
            } else if (typeof self.onend === 'function') {
              /* Tidak ada suara: browser asli memicu onend tanpa hasil. */
              self.onend();
            }
          }, 10);
        }, 10);
      };

      Rec.prototype.stop = function () { if (typeof this.onend === 'function') this.onend(); };
      Rec.prototype.abort = function () {
        state.sttAbortCount++;
        if (typeof this.onend === 'function') this.onend();
      };
    });
  }

  /* ---------------------------------------------------------- microphone */

  catat('mediaDevices', function () {
    if (!navigator.mediaDevices) throw new Error('navigator.mediaDevices tidak ada');
    navigator.mediaDevices.getUserMedia = function () {
      return Promise.resolve({
        getTracks: function () { return []; },
        getAudioTracks: function () { return []; }
      });
    };
  });

  catat('permissions', function () {
    if (!navigator.permissions) throw new Error('navigator.permissions tidak ada');
    navigator.permissions.query = function () { return Promise.resolve({ state: 'granted' }); };
  });

  /* ------------------------------------------------------------ WebAudio */

  if (o.rekamBunyi) {
    /* Alur otomatis memberi respons lewat nada WebAudio. Chrome headless
       dijalankan dengan --mute-audio dan AudioContext butuh izin sentuhan
       pengguna, jadi bunyinya tidak bisa didengar. Yang diperiksa di sini
       adalah bahwa nada itu memang diminta, dengan frekuensi yang benar. */
    catat('audioContext', function () {
      if (!(window.AudioContext || window.webkitAudioContext)) throw new Error('AudioContext tidak ada');
      state.nada = [];

      function Tiruan() {
        var self = this;
        this.state = 'running';
        this.currentTime = 0;
        this.destination = { nama: 'tujuan' };
        this.resume = function () { self.state = 'running'; return Promise.resolve(); };
        this.createGain = function () {
          return {
            gain: { setValueAtTime: function () {}, linearRampToValueAtTime: function () {} },
            connect: function () {}
          };
        };
        this.createOscillator = function () {
          var osc = {
            type: 'sine',
            frequency: { value: 0 },
            connect: function () {},
            start: function (waktu) {
              state.nada.push({ freq: osc.frequency.value, waktu: waktu });
            },
            stop: function () {}
          };
          return osc;
        };
      }

      window.AudioContext = Tiruan;
      window.webkitAudioContext = Tiruan;
    });
  }

  /* ------------------------------------------------ keadaan khusus uji */

  if (o.gambarHilang) {
    /* Jangan menunggu DOMContentLoaded. Skrip aplikasi ada di akhir <body>,
       jadi document.readyState sudah 'interactive' dan app.js menjalankan
       init() serta render() segera - jauh sebelum DOMContentLoaded. Kalau
       penambalan dipasang di sana, latihan pertama sudah terlanjur memakai
       gambar yang benar dan kasus uji ini tidak menguji apa pun.
       Yang dipakai adalah penyetel properti: begitu exercises.js menugaskan
       window.EXERCISES, gambar latihan pertama langsung dialihkan. */
    (function () {
      var nilai = null;
      Object.defineProperty(window, 'EXERCISES', {
        configurable: true,
        enumerable: true,
        get: function () { return nilai; },
        set: function (baru) {
          try {
            if (baru && baru.length) baru[0].image = 'assets/images/tidak-ada.svg';
            state.terpasang.gambarHilang = true;
          } catch (e) {
            state.terpasang.gambarHilang = false;
            state.error = 'gambarHilang: ' + (e && e.message ? e.message : e);
          }
          nilai = baru;
        }
      });
    })();
  }

  if (o.offline) {
    catat('offline', function () {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: function () { return false; } });
      if (navigator.onLine !== false) throw new Error('navigator.onLine masih true');
    });
  } else {
    /* Dipaksa online supaya hasil uji tidak bergantung pada apa yang
       dilaporkan Chrome headless tentang keadaan jaringan mesin ini. */
    catat('online', function () {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: function () { return true; } });
      if (navigator.onLine !== true) throw new Error('navigator.onLine bukan true');
    });
  }

  window.__stub = state;
  window.__stubTerpasang = true;
  return state;
};

function kataTargetDiLayar() {
  var el = document.getElementById('targetWord');
  return el ? String(el.textContent || '').trim().toLowerCase() : '';
}
