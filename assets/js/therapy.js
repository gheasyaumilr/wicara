/* therapy.js - normalisasi dan mesin evaluasi respons (PRD bagian 11 & 14)
 *
 * PRD mendefinisikan hasil evaluasi MATCH / PARTIAL_MATCH / NO_MATCH / NO_RESPONSE
 * tetapi belum menetapkan cara menghitungnya. Implementasi ini memilih aturan
 * berikut dan aturan inilah yang diuji di test.html:
 *
 *   1. transkripsi kosong                        -> NO_RESPONSE
 *   2. transkripsi identik dengan target         -> MATCH
 *   3. target muncul utuh sebagai satu kata di
 *      dalam kalimat ("ini apel" vs target apel) -> MATCH
 *   4. semua kata target terucap (target multi
 *      kata)                                     -> MATCH
 *   5. salah satu string memuat yang lain
 *      ("apelnya" vs "apel")                     -> PARTIAL_MATCH
 *   6. kemiripan Levenshtein >= partialThreshold -> PARTIAL_MATCH
 *   7. selain itu                                -> NO_MATCH
 *
 * Transkripsi STT tidak pernah dipakai sebagai penilaian klinis.
 */
(function (global) {
  'use strict';

  var RESULT = {
    MATCH: 'MATCH',
    PARTIAL_MATCH: 'PARTIAL_MATCH',
    NO_MATCH: 'NO_MATCH',
    NO_RESPONSE: 'NO_RESPONSE'
  };

  var RESPONSE_TYPE = {
    INDEPENDENT: 'INDEPENDENT',
    PROMPTED: 'PROMPTED',
    IMITATED: 'IMITATED',
    APPROXIMATION: 'APPROXIMATION',
    NO_RESPONSE: 'NO_RESPONSE'
  };

  function config() {
    return global.APP_CONFIG || {};
  }

  /* Huruf kecil, buang tanda baca, rapikan spasi. (PRD bagian 14) */
  function normalizeText(value) {
    if (value === null || value === undefined) return '';
    var text = String(value);
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* browser lama */ }
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1);
    var curr = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      curr[0] = i;
      var code = a.charCodeAt(i - 1);
      for (var k = 1; k <= b.length; k++) {
        var cost = code === b.charCodeAt(k - 1) ? 0 : 1;
        var del = prev[k] + 1;
        var ins = curr[k - 1] + 1;
        var sub = prev[k - 1] + cost;
        curr[k] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      }
      var swap = prev; prev = curr; curr = swap;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    var longest = Math.max(a.length, b.length);
    if (longest === 0) return 1;
    return 1 - levenshtein(a, b) / longest;
  }

  function evaluate(target, transcript, options) {
    var opts = options || {};
    var threshold = typeof opts.partialThreshold === 'number'
      ? opts.partialThreshold
      : (typeof config().partialThreshold === 'number' ? config().partialThreshold : 0.6);

    var t = normalizeText(target);
    var r = normalizeText(transcript);

    function out(result, reason) {
      return {
        result: result,
        reason: reason,
        target: t,
        transcript: r,
        similarity: t && r ? Number(similarity(t, r).toFixed(4)) : 0,
        threshold: threshold
      };
    }

    if (!t) return out(RESULT.NO_MATCH, 'target latihan kosong');
    if (!r) return out(RESULT.NO_RESPONSE, 'tidak ada suara yang terbaca');
    if (r === t) return out(RESULT.MATCH, 'sama persis dengan target');

    var spoken = r.split(' ').filter(Boolean);
    if (spoken.indexOf(t) !== -1) {
      return out(RESULT.MATCH, 'target terucap utuh di dalam kalimat');
    }

    var wanted = t.split(' ').filter(Boolean);
    if (wanted.length > 1) {
      var hit = wanted.filter(function (word) { return spoken.indexOf(word) !== -1; }).length;
      if (hit === wanted.length) {
        return out(RESULT.MATCH, 'semua kata target terucap');
      }
    }

    var sim = similarity(t, r);
    if (r.indexOf(t) !== -1 || t.indexOf(r) !== -1) {
      return out(RESULT.PARTIAL_MATCH, 'sebagian target terbaca');
    }
    if (sim >= threshold) {
      return out(RESULT.PARTIAL_MATCH, 'kemiripan ' + sim.toFixed(2) + ' >= ambang ' + threshold);
    }
    return out(RESULT.NO_MATCH, 'kemiripan ' + sim.toFixed(2) + ' < ambang ' + threshold);
  }

  /* Jenis respons anak (PRD bagian 11).
     Catatan: PRD belum menjelaskan jenis respons untuk jawaban yang salah
     tanpa bantuan. Implementasi ini memakai PROMPTED, dan itu ditandai
     sebagai hal yang perlu diputuskan di README. */
  function deriveResponseType(evaluation, attempt, promptLevel) {
    if (!evaluation) return RESPONSE_TYPE.NO_RESPONSE;
    if (evaluation.result === RESULT.NO_RESPONSE) return RESPONSE_TYPE.NO_RESPONSE;
    if (evaluation.result === RESULT.PARTIAL_MATCH) return RESPONSE_TYPE.APPROXIMATION;
    if (evaluation.result === RESULT.MATCH) {
      if (promptLevel && promptLevel !== 'P0') return RESPONSE_TYPE.PROMPTED;
      return attempt <= 1 ? RESPONSE_TYPE.INDEPENDENT : RESPONSE_TYPE.PROMPTED;
    }
    return RESPONSE_TYPE.PROMPTED;
  }

  /* Tingkat bantuan (PRD bagian 11).
     P0 = mandiri, P1 = instruksi diulang secara lisan. Percobaan pertama
     selalu P0; percobaan berikutnya dianggap P1 karena anak sudah diminta
     mencoba lagi. Orang tua dapat menaikkannya dari Mode Orang Tua. */
  function derivePromptLevel(attempt, manualLevel) {
    if (manualLevel) return manualLevel;
    if (attempt <= 1) return 'P0';
    if (attempt === 2) return 'P1';
    return 'P2';
  }

  function isCorrect(result) {
    return result === RESULT.MATCH;
  }

  function label(result) {
    switch (result) {
      case RESULT.MATCH: return 'Tepat';
      case RESULT.PARTIAL_MATCH: return 'Hampir';
      case RESULT.NO_MATCH: return 'Belum sesuai';
      case RESULT.NO_RESPONSE: return 'Tidak ada suara';
      default: return result || '-';
    }
  }

  global.Therapy = {
    RESULT: RESULT,
    RESPONSE_TYPE: RESPONSE_TYPE,
    normalizeText: normalizeText,
    levenshtein: levenshtein,
    similarity: similarity,
    evaluate: evaluate,
    deriveResponseType: deriveResponseType,
    derivePromptLevel: derivePromptLevel,
    isCorrect: isCorrect,
    label: label
  };
})(window);
