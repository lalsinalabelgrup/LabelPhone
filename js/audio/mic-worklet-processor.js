/**
 * mic-worklet-processor.js
 * AudioWorkletProcessor for mic capture, running on the dedicated audio
 * rendering thread (not the main thread). Batches the fixed-size 128-sample
 * quanta Web Audio delivers into larger, regular chunks and posts each full
 * chunk to the main thread as a transferable ArrayBuffer.
 *
 * Constraints (audio-thread code must not do either of these):
 *   - No allocation per quantum. A chunk buffer is allocated once, filled
 *     across multiple process() calls, and only replaced (one allocation)
 *     at the chunk boundary when it's handed off via postMessage.
 *   - No logging. console.log/postMessage-for-logging on this thread can
 *     block real-time audio processing; diagnostics belong on the main
 *     thread, driven off the chunks this processor already sends.
 */
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this._chunkSamples = opts.chunkSamples || 512; // ~10.7ms @48kHz
    this._buffer = new Float32Array(this._chunkSamples);
    this._writeOffset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (!channel || channel.length === 0) return true;

    let readOffset = 0;
    while (readOffset < channel.length) {
      const spaceLeft = this._chunkSamples - this._writeOffset;
      const toCopy = Math.min(spaceLeft, channel.length - readOffset);
      this._buffer.set(channel.subarray(readOffset, readOffset + toCopy), this._writeOffset);
      this._writeOffset += toCopy;
      readOffset += toCopy;

      if (this._writeOffset >= this._chunkSamples) {
        const full = this._buffer;
        this._buffer = new Float32Array(this._chunkSamples); // allocation only at chunk-boundary rate
        this._writeOffset = 0;
        this.port.postMessage({ samples: full.buffer, sampleRate, chunkSamples: this._chunkSamples }, [full.buffer]);
      }
    }

    return true; // keep processing for the lifetime of the node
  }
}

registerProcessor('mic-capture-processor', MicCaptureProcessor);
