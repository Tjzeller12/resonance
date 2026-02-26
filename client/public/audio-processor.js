/* eslint-env audioworklet */
// or, if that doesn't work with your config:
/* global AudioWorkletProcessor, registerProcessor */

// AudioWorkletProcessor.process() is called by the Web Audio API with exactly 128 frames per call (spec-defined).
// However, the Rust McLeod pitch detector requires exactly 2048 samples to run (see sensors.rs: const SIZE: usize = 2048).
// We must accumulate chunks in a buffer and only post a message once we have 2048 samples.
// This means pitch data arrives ~every 16 chunks (16 * 128 = 2048) instead of every chunk, which is fine.
class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // Internal Float32 accumulation buffer — holds samples until we reach MIN_SEND_SIZE
        this._buffer = [];
        // Must match the SIZE constant in sensors.rs (const SIZE: usize = 2048)
        this._targetSize = 2048;
    }

    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            // Accumulate the incoming 128-sample chunk into the buffer
            for (let i = 0; i < input[0].length; i++) {
                this._buffer.push(input[0][i]);
            }

            // Only post to the main thread once we have a full 2048-sample window
            if (this._buffer.length >= this._targetSize) {
                const chunk = new Float32Array(this._buffer.splice(0, this._targetSize));
                this.port.postMessage(chunk);
            }
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);