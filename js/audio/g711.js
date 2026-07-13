/**
 * g711.js
 * G.711 A-law (PCMA) codec — encode/decode only, no resampling.
 * Pure functions, no module state. PCMA only (per scope limits in the
 * two-way-audio plan — no PCMU/GSM/Opus support).
 */

console.log('[G711] corrected encoder loaded - build 2');

const g711 = (() => {

  let _loggedFirstEncode = false;

  function linearToAlawSample(sample) {
    let pcm = sample | 0;
    let mask;

    if (pcm >= 0) {
      mask = 0xD5;
    } else {
      mask = 0x55;
      pcm = -pcm - 1;
    }

    if (pcm > 32635) {
      pcm = 32635;
    }

    let seg;

    if (pcm >= 256) {
      seg = 1;

      let value = pcm >> 8;
      while (value > 1) {
        seg++;
        value >>= 1;
      }

      const aval =
        (seg << 4) |
        ((pcm >> (seg + 3)) & 0x0F);

      return (aval ^ mask) & 0xFF;
    }

    return ((pcm >> 4) ^ mask) & 0xFF;
  }

  function alawToLinearSample(alaw) {
    alaw ^= 0x55;
    const sign = alaw & 0x80;
    const seg  = (alaw & 0x70) >> 4;
    const mantissa = alaw & 0x0F;

    let sample;
    if (seg === 0) {
      sample = (mantissa << 4) + 8;
    } else {
      sample = ((mantissa << 4) + 0x108) << (seg - 1);
    }
    return sign ? sample : -sample;
  }

  /** Float32Array (range -1..1) -> Uint8Array (A-law bytes) */
  function alawEncode(floatSamples) {
    if (!_loggedFirstEncode) {
      _loggedFirstEncode = true;
      console.log('[G711] corrected encoder used for first microphone frame');
    }
    const out = new Uint8Array(floatSamples.length);
    for (let i = 0; i < floatSamples.length; i++) {
      let pcm = Math.round(floatSamples[i] * 32767);
      if (pcm > 32767) pcm = 32767;
      if (pcm < -32768) pcm = -32768;
      out[i] = linearToAlawSample(pcm);
    }
    return out;
  }

  /** Uint8Array (A-law bytes) -> Float32Array (range -1..1) */
  function alawDecode(alawBytes) {
    const out = new Float32Array(alawBytes.length);
    for (let i = 0; i < alawBytes.length; i++) {
      out[i] = alawToLinearSample(alawBytes[i]) / 32768;
    }
    return out;
  }

  return { alawEncode, alawDecode };
})();
