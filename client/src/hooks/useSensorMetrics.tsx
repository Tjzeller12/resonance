import { useCallback, useRef, useState } from "react";
import { SENSOR_WS_URL } from "../config";

/**
 * SensorMetrics represents the raw audio physics data processed by the Rust backend.
 */
export interface SensorMetrics {
    /** The instantaneous volume/amplitude */
    volume: number;
    /** The detected fundamental frequency (Hz) */
    pitch: number;
    /** A measure of pitch stability over a short window */
    pitch_variance: number;
    /** Voice Activity Detection (VAD) status */
    is_speaking: boolean;
}

/**
 * matches the JSON structure returned by the Rust backend's AudioMetrics packet.
 */
interface AudioMetricsMessage {
    type: 'AudioMetrics';
    data: SensorMetrics;
}

/**
 * A single word with its exact audio-stream-relative timestamps.
 */
export interface WordData {
    word: string;
    /** Seconds into the audio stream when this word started */
    start: number;
    /** Seconds into the audio stream when this word ended */
    end: number;
    /** Deepgram confidence (0.0 - 1.0) */
    confidence: number;
}

/**
 * A batch of finalized words from Deepgram streaming.
 * Emitted each time Deepgram finalizes a segment of speech.
 */
export interface WordBatch {
    /** Unix ms epoch when the Deepgram stream started */
    stream_epoch_ms: number;
    /** Finalized words with timestamps */
    words: WordData[];
    /** Transcript for this segment */
    transcript: string;
    /** True when Deepgram detects end-of-utterance (sentence boundary) */
    speech_final: boolean;
}

interface WordBatchMessage {
    type: 'WordBatch';
    data: WordBatch;
}

export interface LiveTags {
    tags: string[];
}

interface LiveTagsMessage {
    type: 'LiveTags';
    data: LiveTags;
}

interface UnknownMessage {
    type: string;
}

type ServerMessage = AudioMetricsMessage | WordBatchMessage | LiveTagsMessage | UnknownMessage;

/**
 * useSensorMetrics manages the "Sensor" half of the architecture.
 * 
 * It is responsible for:
 * 1. Capturing raw microphone audio via the Web Audio API.
 * 2. Processing that audio through an AudioWorklet to get raw PCM data.
 * 3. Streaming Int16 PCM audio at 16kHz to the Rust backend via WebSocket.
 * 4. Receiving and storing real-time vocal metrics from the Rust backend.
 * 
 * @returns {Object} { isConnected, isStreaming, sensorMetrics, pitchHistory, startStreaming, stopStreaming, connect, disconnect }
 */
export const useSensorMetrics = () => {
    // Number of data points to keep for the pitch trend chart
    const MAX_HISTORY: number = 60;
    
    // --- State ---
    const [sensorMetrics, setSensorMetrics] = useState<SensorMetrics | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [pitchHistory, setPitchHistory] = useState<number[]>([]);
    const [wordBatches, setWordBatches] = useState<WordBatch[]>([]);
    const [liveTags, setLiveTags] = useState<LiveTags[]>([]);

    // --- Refs: Used for persistent objects that don't need to trigger re-renders ---
    const ws: React.RefObject<WebSocket | null> = useRef<WebSocket | null>(null);              
    const audioContext: React.RefObject<AudioContext | null> = useRef<AudioContext | null>(null); 
    const mediaStream: React.RefObject<MediaStream | null>= useRef<MediaStream | null>(null);  
    const workletNode = useRef<AudioWorkletNode | null>(null);

    // Exponential Moving Average (EMA) for smoothing output pitch values
    const smoothedPitch = useRef<number>(0);
    const EMA_ALPHA = 0.8;

    /**
     * startStreaming builds the browser's audio pipeline.
     * 
     * RATIONALE:
     * Standard Hume SDK handles audio internally, but for the "Sensor Fusion" feature,
     * we need to stream our OWN copy of the audio to a custom Rust server for 
     * low-latency physics analysis (pitch, volume).
     */
    const startStreaming = async () => {
        try {
            /** 
             * Create audio context at 16kHz. 
             * 16kHz is the "Golden Standard" for speech models (Hume, Deepgram, Gemini).
             */
            audioContext.current = new window.AudioContext({ sampleRate: 16000 });

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000 }
            });

            mediaStream.current = stream;

            const source = audioContext.current.createMediaStreamSource(stream);

            /** 
             * Register the AudioWorklet processor. 
             * This processor (found in public/audio-processor.js) runs on a 
             * high-priority thread to prevent audio drop-outs.
             */
            await audioContext.current.audioWorklet.addModule('/audio-processor.js');

            workletNode.current = new AudioWorkletNode(audioContext.current, 'audio-processor');

            // Connect the graph: Microphone -> Processor (Captures PCM) -> Destination (Silent)
            source.connect(workletNode.current);
            workletNode.current.connect(audioContext.current.destination);

            if (audioContext.current.state === 'suspended') {
                await audioContext.current.resume();
            }

            /**
             * The worklet sends us Float32 chunks. 
             * We convert them to Int16 before sending to Rust to save bandwidth
             * and match the expectations of our DSP (Digital Signal Processing) engine.
             */
            workletNode.current.port.onmessage = (event: MessageEvent<Float32Array>) => {
                if (ws.current?.readyState === WebSocket.OPEN) {
                    const float32Data: Float32Array = event.data;
                    const int16Data = new Int16Array(float32Data.length);
                    for(let i = 0; i < float32Data.length; i++) {
                        const s = Math.max(-1, Math.min(1, float32Data[i])); // clamp
                        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;     // scale 
                    }
                    ws.current.send(int16Data.buffer);
                }
            }
            setIsStreaming(true);
        } catch (err) {
            console.error('[Sensor] Audio Streaming Error', err);
        }
    }

    /**
     * stopStreaming releases hardware resources.
     * VERY IMPORTANT: We must stop the MediaStream tracks, otherwise the browser's
     * "Mic in use" red indicator will stay on indefinitely.
     */
    const stopStreaming = async () => {
        try {
            if (isStreaming) {
                if (workletNode.current) {
                    workletNode.current.disconnect();
                    workletNode.current = null;
                }

                if (audioContext.current) {
                    await audioContext.current.close();
                    audioContext.current = null;
                }

                if (mediaStream.current) {
                    mediaStream.current.getTracks().forEach(track => track.stop());
                    mediaStream.current = null;
                }

                setIsStreaming(false);
            }

        } catch (err) {
            console.error('[Sensor] Error stopping stream', err);
        }
    }

    /**
     * handleMessage processes signals sent back from the Rust backend.
     * Handles both real-time AudioMetrics and post-turn DeepgramAnalysis.
     */
    const handleMessage = useCallback((data: unknown) => {
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data) as ServerMessage;
                if (msg.type === 'AudioMetrics') {
                    const metrics = (msg as AudioMetricsMessage).data;
                    setSensorMetrics(metrics);
                    
                    /**
                     * Smooth the pitch data for the visual timeline.
                     * We ignore values < 80Hz as they are usually noise or silence.
                     */
                    if (metrics.pitch > 80) {
                        smoothedPitch.current = (EMA_ALPHA * metrics.pitch) + ((1 - EMA_ALPHA) * smoothedPitch.current);
                        setPitchHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), smoothedPitch.current]);
                    }
                } else if (msg.type === 'WordBatch') {
                    const batch = (msg as WordBatchMessage).data;
                    setWordBatches(prev => [...prev, batch]);
                    if (batch.speech_final) {
                        console.log('%c[Sensor] 📝 Sentence complete', 'color: #06b6d4; font-weight: bold;',
                            `"${batch.transcript}"`);
                    }
                } else if (msg.type === 'LiveTags') {
                    const tagsData = (msg as LiveTagsMessage).data;
                    setLiveTags(prev => [...prev, tagsData]);
                    console.log('%c[Gemini Live] 🏷️ Received tags', 'color: #a855f7; font-weight: bold;', tagsData.tags);
                }
            } catch (err) {
                console.error("[Sensor] JSON Parse Error", err);
            }
        }
    }, []);

    /**
     * connect creates the control-plane connection to the Rust backend.
     */
    const connect = useCallback((): void => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        try {
            console.log('[Sensor] Connecting to WebSocket...');
            ws.current = new WebSocket(SENSOR_WS_URL);
            ws.current.binaryType = 'arraybuffer';

            ws.current.onopen = () => {
                console.log('[Sensor] WebSocket Connected');
                setIsConnected(true);
            };

            ws.current.onclose = (e) => {
                console.log('[Sensor] WebSocket Closed', e.code, e.reason);
                setIsConnected(false);
                setIsStreaming(false);
                setSensorMetrics(prev => ({
                    volume: 0,
                    pitch: 0,
                    pitch_variance: prev?.pitch_variance ?? 0,
                    is_speaking: false
                }));
            };

            ws.current.onerror = (e) => {
                console.error('[Sensor] WebSocket Error', e);
            };

            ws.current.onmessage = (e) => {
                handleMessage(e.data);
            };
        } catch (err) {
            console.error('[Sensor] Connection Error', err);
        }
    }, [handleMessage]);

    /**
     * disconnect closes the socket and prevents leaks by nulling out handlers.
     */
    const disconnect = useCallback(() => {
        if (ws.current) {
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.onmessage = null;
            ws.current.close();
            ws.current = null;
        }
        setIsConnected(false);
        setIsStreaming(false);
        return true;
    }, []);

    return {
        isConnected,
        isStreaming,
        sensorMetrics,
        pitchHistory,
        wordBatches,
        liveTags,
        startStreaming,
        stopStreaming,
        connect,
        disconnect
    }
}
