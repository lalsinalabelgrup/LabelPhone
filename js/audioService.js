/**
 * audioService.js
 * Web Audio API sound engine for LabelPhone.
 *
 * All tones are synthesised in-browser — no audio files required.
 * The AudioContext is created lazily on first user interaction to satisfy
 * browser autoplay policies.
 *
 * Future audio packs can be layered on top of this module by replacing the
 * synthesis functions with sample-playback implementations while preserving
 * the same public interface.
 */

const audioService = (() => {

  /* ── DTMF frequency pairs (ITU-T Q.23) ─────────────── */
  const DTMF = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
  };

  /* ── Internal state ─────────────────────────────────── */
  let _ctx    = null;
  let _enabled = true;
  let _volume  = 0.25;
  let _ringbackLoop = null;   // {osc1, osc2, gain, stopFn}
  let _ringbackPlaying = false;

  /* ── Context bootstrap ──────────────────────────────── */
  function _ctx_() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  /* ── Generic tone burst ─────────────────────────────── */
  function _burst(freqs, duration = 0.12, gain = _volume) {
    if (!_enabled) return;
    const ctx = _ctx_();
    const t   = ctx.currentTime;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(gain, t + 0.006);
    gainNode.gain.setValueAtTime(gain, t + duration - 0.025);
    gainNode.gain.linearRampToValueAtTime(0, t + duration);
    gainNode.connect(ctx.destination);

    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start(t);
      osc.stop(t + duration + 0.01);
    });
  }

  /* ── Ringback (continuous loop until stopped) ────────── */
  function _scheduleRingback() {
    if (!_enabled || !_ringbackPlaying) return;
    const ctx = _ctx_();
    const t   = ctx.currentTime;

    // European ringback: ~400+450 Hz, 1s on / 4s off
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(_volume * 0.6, t + 0.02);
    gainNode.gain.setValueAtTime(_volume * 0.6, t + 0.98);
    gainNode.gain.linearRampToValueAtTime(0, t + 1.0);
    gainNode.connect(ctx.destination);

    [400, 450].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start(t);
      osc.stop(t + 1.1);
    });

    _ringbackLoop = setTimeout(_scheduleRingback, 5000); // 1s ring + 4s silence
  }

  /* ── Public API ─────────────────────────────────────── */
  return {

    /** Play DTMF tone for a keypad digit. */
    dtmf(digit) {
      const freqs = DTMF[digit];
      if (freqs) _burst(freqs, 0.12);
    },

    /** Start ringback tone loop (outgoing ring). */
    startRingback() {
      if (_ringbackPlaying) return;
      _ringbackPlaying = true;
      _scheduleRingback();
    },

    /** Stop ringback tone. */
    stopRingback() {
      _ringbackPlaying = false;
      clearTimeout(_ringbackLoop);
    },

    /**
     * Play incoming ringtone.
     * Simple ascending triple-tone pattern, loops until stopped.
     * Future: replace with actual ringtone audio pack.
     */
    startRingtone() {
      if (_ringbackPlaying) return;
      _ringbackPlaying = true;
      const _ring = () => {
        if (!_ringbackPlaying) return;
        if (!_enabled) { _ringbackLoop = setTimeout(_ring, 3500); return; }
        const ctx = _ctx_();
        const t   = ctx.currentTime;
        [[880, 0], [1108, 0.15], [1480, 0.30]].forEach(([freq, delay]) => {
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t + delay);
          g.gain.linearRampToValueAtTime(_volume * 0.5, t + delay + 0.01);
          g.gain.setValueAtTime(_volume * 0.5, t + delay + 0.10);
          g.gain.linearRampToValueAtTime(0, t + delay + 0.15);
          g.connect(ctx.destination);
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.connect(g);
          osc.start(t + delay);
          osc.stop(t + delay + 0.18);
        });
        _ringbackLoop = setTimeout(_ring, 2200);
      };
      _ring();
    },

    stopRingtone() {
      _ringbackPlaying = false;
      clearTimeout(_ringbackLoop);
    },

    /** Two-tone ascending "call connected" chime. */
    playConnected() {
      if (!_enabled) return;
      _burst([880],  0.14, _volume * 0.4);
      setTimeout(() => _burst([1108], 0.14, _volume * 0.4), 160);
    },

    /** Soft click — call ended. */
    playHangup() {
      if (!_enabled) return;
      const ctx = _ctx_();
      const t   = ctx.currentTime;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = _volume * 0.3;
      src.connect(g); g.connect(ctx.destination);
      src.start(t);
    },

    /* ── Settings ─────────────────────────────────────── */
    setEnabled(bool) { _enabled = !!bool; },
    getEnabled()     { return _enabled; },
    setVolume(v)     { _volume = Math.max(0, Math.min(1, v)); },
    getVolume()      { return _volume; },

    /** Short two-tone beep played just before auto-answer fires. */
    playAutoAnswerBeep() {
      if (!_enabled) return;
      _burst([660], 0.08, _volume * 0.45);
      setTimeout(() => _burst([880], 0.08, _volume * 0.45), 110);
    },

    /** Warm up AudioContext on first user gesture (avoids delay on first tone). */
    prime() { _ctx_(); },
  };

})();
