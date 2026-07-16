/**
 * audioManager.js
 * Owns the mic-capture / remote-playback lifecycle for the audio-over-
 * WebSocket relay. Encodes outbound mic audio to G.711 A-law (PCMA) and
 * decodes inbound frames for playback — no other module touches
 * getUserMedia/AudioContext/the WebSocket audio channel directly.
 *
 * Mic capture: AudioWorkletNode is the primary path (runs on the dedicated
 * audio rendering thread, delivers small/regular ~10.7ms chunks instead of
 * ScriptProcessorNode's ~85ms bursts — see js/audio/mic-worklet-processor.js).
 * ScriptProcessorNode is kept only as a compatibility fallback for browsers/
 * contexts where AudioWorklet is unavailable (deprecated, but still widely
 * supported). Both paths feed the same per-chunk processing function so
 * encoding/sending/diagnostics logic isn't duplicated.
 *
 * Scope limits (see two-way-audio plan): PCMA only, naive linear
 * resampling to/from 8kHz, no jitter buffer beyond simple sequential
 * scheduling. Depends on globals: telephonyGatewayClient, g711, UI, I18N.
 */

const AudioManager = (() => {

  const FRAME_SAMPLES = 160; // 20ms @ 8kHz
  const WORKLET_URL = 'js/audio/mic-worklet-processor.js';
  const WORKLET_CHUNK_SAMPLES = 512; // ~10.7ms @48kHz

  let _micStream    = null;
  let _micCtx        = null;
  let _micSource     = null;
  let _micProcessor  = null;   // ScriptProcessorNode fallback only
  let _micWorkletNode = null;  // AudioWorkletNode primary path only
  let _usingWorklet  = false;
  let _micResidual   = new Float32Array(0);

  let _playCtx       = null;
  let _playDest       = null;
  let _playCursor     = 0;
  let _audioEl        = null;

  let _firstFrameSent     = false;
  let _firstFrameReceived = false;
  let _started            = false;
  let _held               = false; // true while the call is on Hold — mic keeps capturing, frames are discarded, not sent/queued
  let _muted              = false; // true while the user has pressed Mute — same discard-not-queue treatment as _held, independent of it

  let _micFrameCount  = 0; // TEMP diagnostics (Phase 7) — remove once outbound audio is confirmed fixed
  let _sentFrameCount = 0;

  // TEMP diagnostics — mic producer stats (see _processCapturedSamples), logged
  // every 50 callbacks to characterize real callback cadence/burst shape.
  // Kept as a per-window array (not per-packet logging — only the aggregated
  // min/max/avg/stddev is logged) so min/stddev can be computed without
  // carrying extra running-moment state.
  let _lastCallbackAtMs = null;
  let _windowIntervals  = [];
  let _windowFramesSum  = 0;

  // Streaming resampler state — carried across callbacks so fractional
  // source phase and the interpolation boundary sample survive between
  // calls instead of resetting every callback (see _resampleStreaming).
  let _resamplePos   = 0;
  let _resampleCarry = null;

  function _log(...args) {
    console.log('[AudioManager]', ...args);
  }

  /**
   * Streaming linear resampler: preserves fractional source position and one
   * trailing input sample across calls so consecutive capture callbacks
   * resample as one continuous stream, not independent chunks.
   */
  function _resampleStreaming(input, inRate, outRate) {
    if (inRate === outRate) return input;
    const ratio = inRate / outRate;

    const hasCarry = _resampleCarry !== null;
    const ext = hasCarry ? Float32Array.of(_resampleCarry, ...input) : input;
    const posOffset = hasCarry ? 1 : 0; // ext[i] holds source time (i - posOffset)

    const out = [];
    let pos = _resamplePos; // position in "this chunk" coordinates (0 = chunk's first sample)
    for (;;) {
      const extIndex = pos + posOffset;
      const i0 = Math.floor(extIndex);
      const i1 = i0 + 1;
      if (i1 >= ext.length) break; // not enough lookahead yet — carry to next callback
      const frac = extIndex - i0;
      out.push(ext[i0] + (ext[i1] - ext[i0]) * frac);
      pos += ratio;
    }

    _resamplePos = pos - input.length; // same physical position, in next chunk's coordinates
    _resampleCarry = input[input.length - 1];

    return Float32Array.from(out);
  }

  /**
   * Shared per-chunk pipeline: resample -> slice into 160-sample frames ->
   * encode -> send over WS -> diagnostics. Called from both the AudioWorklet
   * message handler and the ScriptProcessorNode fallback's onaudioprocess,
   * so neither path duplicates this logic.
   */
  function _processCapturedSamples(input, inRate, callbackAtMs) {
    const resampled = inRate === 8000 ? input : _resampleStreaming(input, inRate, 8000);

    _micFrameCount++;

    const intervalMs = _lastCallbackAtMs === null ? 0 : callbackAtMs - _lastCallbackAtMs;
    _lastCallbackAtMs = callbackAtMs;
    _windowIntervals.push(intervalMs);

    if (_micFrameCount === 1 || _micFrameCount % 50 === 0) {
      _log('[AUDIO MIC]', 'captured samples', {
        inRate, rawSamples: input.length, resampledSamples: resampled.length,
        callCount: _micFrameCount, capturePath: _usingWorklet ? 'AudioWorklet' : 'ScriptProcessor',
      });

      let min = Infinity, max = -Infinity, sumSq = 0;
      for (let i = 0; i < input.length; i++) {
        const s = input[i];
        if (s < min) min = s;
        if (s > max) max = s;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / input.length);
      _log('[AUDIO RAW]', { min, max, rms, inputSampleRate: inRate });
    }

    const combined = new Float32Array(_micResidual.length + resampled.length);
    combined.set(_micResidual, 0);
    combined.set(resampled, _micResidual.length);

    const frameSendTimesMs = [];
    let framesThisCallback = 0;

    let offset = 0;
    while (combined.length - offset >= FRAME_SAMPLES) {
      const frame = combined.subarray(offset, offset + FRAME_SAMPLES);
      // Held/muted frames are discarded here, not queued — on Resume/Unmute,
      // transmission continues from whatever the mic is producing at that
      // moment, with no backlog of suppressed-period audio to burst out.
      if (!_held && !_muted) {
        const encoded = g711.alawEncode(frame);
        if (encoded.byteLength !== FRAME_SAMPLES) {
          _log('[AUDIO WS OUT]', 'WARNING encoded frame is not 160 bytes', encoded.byteLength);
        }
        telephonyGatewayClient.sendAudioFrame(encoded.buffer);
        frameSendTimesMs.push(performance.now());
        framesThisCallback++;
        _sentFrameCount++;
        if (_sentFrameCount === 1 || _sentFrameCount % 50 === 0) {
          _log('[AUDIO WS OUT]', 'sent bytes', { bytes: encoded.byteLength, count: _sentFrameCount });

          const uniqueByteCount = new Set(encoded).size;
          const first16Bytes = Array.from(encoded.subarray(0, 16))
            .map((b) => '0x' + b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
          _log('[AUDIO ALAW]', { uniqueByteCount, first16Bytes });
        }
        if (!_firstFrameSent) {
          _firstFrameSent = true;
          _log('first frame sent');
        }
      }
      offset += FRAME_SAMPLES;
    }
    _micResidual = combined.subarray(offset);
    _windowFramesSum += framesThisCallback;

    if (_micFrameCount === 1 || _micFrameCount % 50 === 0) {
      const samples = _windowIntervals;
      const validSamples = samples.filter((v) => v > 0); // first sample of the session has no prior callback
      let avgMs = 0, minMs = 0, maxMs = 0, stddevMs = 0;
      if (validSamples.length > 0) {
        const sum = validSamples.reduce((a, b) => a + b, 0);
        avgMs = sum / validSamples.length;
        minMs = Math.min(...validSamples);
        maxMs = Math.max(...validSamples);
        const variance = validSamples.reduce((acc, v) => acc + (v - avgMs) * (v - avgMs), 0) / validSamples.length;
        stddevMs = Math.sqrt(variance);
      }
      _log('[AUDIO PRODUCER STATS]', {
        capturePath: _usingWorklet ? 'AudioWorklet' : 'ScriptProcessor',
        micCallbacks: _micFrameCount,
        avgCallbackIntervalMs: avgMs,
        minCallbackIntervalMs: minMs,
        maxCallbackIntervalMs: maxMs,
        stddevCallbackIntervalMs: stddevMs,
        avgFramesPerCallback: samples.length > 0 ? _windowFramesSum / samples.length : 0,
        completeFramesProduced: _sentFrameCount,
        framesSentOverWs: _sentFrameCount,
        residualSamples: _micResidual.length,
      });
      _log('[AUDIO PRODUCER BURST]', {
        callbackNumber: _micFrameCount,
        framesProducedThisCallback: framesThisCallback,
        frameSendTimesMs,
      });
      _windowIntervals = [];
      _windowFramesSum = 0;
    }
  }

  // ScriptProcessorNode fallback — deprecated, kept only for browsers/contexts
  // where AudioWorklet is unavailable. Delegates to the same per-chunk
  // pipeline the AudioWorklet path uses.
  function _onMicProcess(e) {
    const callbackAtMs = performance.now();
    const input = e.inputBuffer.getChannelData(0);
    _processCapturedSamples(input, _micCtx.sampleRate, callbackAtMs);
  }

  function _startScriptProcessorFallback(reason) {
    _log('[AUDIO MIC]', 'capture mode: ScriptProcessor fallback', { reason });
    _micProcessor = _micCtx.createScriptProcessor(4096, 1, 1);
    _micProcessor.onaudioprocess = _onMicProcess;
    _micSource.connect(_micProcessor);
    _micProcessor.connect(_micCtx.destination);
    _usingWorklet = false;
  }

  async function _startAudioWorkletCapture() {
    if (!_micCtx.audioWorklet) {
      throw new Error('audioWorklet unavailable on this AudioContext (requires a secure context)');
    }
    await _micCtx.audioWorklet.addModule(WORKLET_URL);
    _micWorkletNode = new AudioWorkletNode(_micCtx, 'mic-capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      processorOptions: { chunkSamples: WORKLET_CHUNK_SAMPLES },
    });
    _micWorkletNode.port.onmessage = (e) => {
      const { samples, sampleRate } = e.data;
      _processCapturedSamples(new Float32Array(samples), sampleRate || _micCtx.sampleRate, performance.now());
    };
    _micWorkletNode.onprocessorerror = (err) => {
      _log('[AUDIO MIC]', 'AudioWorklet processor error', err);
    };
    _micSource.connect(_micWorkletNode);
    // Not routing captured audio anywhere — output stays zero (never written
    // in the processor) — connecting to destination only keeps the node
    // pulled by the graph, matching the existing ScriptProcessor pattern.
    _micWorkletNode.connect(_micCtx.destination);
    _usingWorklet = true;
    _log('[AUDIO MIC]', 'using AudioWorklet capture', {
      chunkSamples: WORKLET_CHUNK_SAMPLES,
      approxChunkMs: (WORKLET_CHUNK_SAMPLES / _micCtx.sampleRate) * 1000,
    });
  }

  function _ensurePlaybackGraph() {
    if (_playCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    _playCtx = new AC();
    _playDest = _playCtx.createMediaStreamDestination();
    _playCursor = _playCtx.currentTime;

    _audioEl = document.createElement('audio');
    _audioEl.autoplay = true;
    _audioEl.srcObject = _playDest.stream;
    document.body.appendChild(_audioEl);
    _audioEl.play().catch((err) => _log('remote <audio> play() failed', err));
    _log('audio element created');
  }

  function _onRemoteFrame(buf) {
    if (!_started) return;
    _ensurePlaybackGraph();

    const alawBytes = new Uint8Array(buf);
    const samples = g711.alawDecode(alawBytes);

    const durationSec = samples.length / 8000;
    const buffer = _playCtx.createBuffer(1, samples.length, 8000);
    buffer.copyToChannel(samples, 0);

    const src = _playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(_playDest);

    const now = _playCtx.currentTime;
    if (_playCursor < now) _playCursor = now;
    src.start(_playCursor);
    _playCursor += durationSec;

    if (!_firstFrameReceived) {
      _firstFrameReceived = true;
      _log('first frame received');
      _log('remote stream attached');
    }
  }

  async function start() {
    if (_started) return;
    _started = true;
    _firstFrameSent = false;
    _firstFrameReceived = false;
    _held = false;
    _muted = false;
    _micFrameCount = 0;
    _sentFrameCount = 0;
    _lastCallbackAtMs = null;
    _windowIntervals = [];
    _windowFramesSum = 0;
    _resamplePos = 0;
    _resampleCarry = null;

    telephonyGatewayClient.onAudioFrame(_onRemoteFrame);

    try {
      _micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _log('mic permission granted');
      const track = _micStream.getAudioTracks()[0];
      if (track) {
        _log('[AUDIO MIC]', 'track', { label: track.label, enabled: track.enabled, muted: track.muted, readyState: track.readyState });
      }
    } catch (err) {
      _log('mic permission denied', err.message);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(typeof I18N !== 'undefined' ? I18N.t('toast.mic_denied') : 'Microphone unavailable');
      }
      _started = false;
      return;
    }

    const AC = window.AudioContext || window.webkitAudioContext;
    _micCtx = new AC();
    _micSource = _micCtx.createMediaStreamSource(_micStream);

    try {
      await _startAudioWorkletCapture();
    } catch (err) {
      _micWorkletNode = null;
      _startScriptProcessorFallback(err.message);
    }
    _log('local stream created');
  }

  function stop() {
    telephonyGatewayClient.onAudioFrame(null);

    if (_micWorkletNode) {
      _micWorkletNode.port.onmessage = null;
      _micWorkletNode.onprocessorerror = null;
      _micWorkletNode.disconnect();
      _micWorkletNode = null;
    }
    if (_micProcessor) {
      _micProcessor.disconnect();
      _micProcessor.onaudioprocess = null;
      _micProcessor = null;
    }
    if (_micSource) {
      _micSource.disconnect();
      _micSource = null;
    }
    if (_micCtx) {
      _micCtx.close().catch(() => {});
      _micCtx = null;
    }
    if (_micStream) {
      _micStream.getTracks().forEach((t) => t.stop());
      _micStream = null;
    }
    _usingWorklet = false;
    _micResidual = new Float32Array(0);
    _held = false;
    _muted = false;
    _resamplePos = 0;
    _resampleCarry = null;

    if (_audioEl) {
      _audioEl.pause();
      _audioEl.srcObject = null;
      _audioEl.remove();
      _audioEl = null;
      _log('audio element destroyed');
    }
    if (_playCtx) {
      _playCtx.close().catch(() => {});
      _playCtx = null;
    }
    _playDest = null;
    _playCursor = 0;

    _started = false;
    _log('cleanup completed');
  }

  /**
   * Toggle outgoing-frame transmission for Hold/Resume. The mic stream,
   * AudioContext and capture pipeline stay alive and keep producing frames —
   * only the encode+send step is skipped while held, so Resume has zero
   * setup delay and no backlog to flush.
   */
  function setHeld(held) {
    _held = !!held;
  }

  /**
   * Toggle outgoing-frame transmission for Mute/Unmute. Same discard-not-queue
   * treatment as setHeld, and independent of it — muted state is preserved
   * across Hold/Resume, and held frames stay suppressed regardless of mute.
   */
  function setMuted(muted) {
    _muted = !!muted;
  }

  function toggleMuted() {
    _muted = !_muted;
    return _muted;
  }

  function isMuted() {
    return _muted;
  }

  return { start, stop, setHeld, setMuted, toggleMuted, isMuted };
})();
