import { useEffect, useRef, useState } from 'react';
import type { LiveTags, SensorMetrics } from './useSensorMetrics';

// ============================================================
//  DATA TYPES
// ============================================================

/**
 * Per-word metrics: each word mapped to the exact pitch/volume
 * from the sensor buffer at the moment it was spoken.
 */
export interface WordMetrics {
    word: string;
    /** Deepgram confidence for this word (0.0 - 1.0) */
    confidence: number;
    /** Average pitch (Hz) during this word */
    avgPitch: number;
    /** Average volume (0-1) during this word */
    avgVolume: number;
    /** Deepgram timestamp: seconds into stream */
    start: number;
    end: number;
}

/**
 * SentenceDebugData contains the technical details for a completed sentence.
 */
export interface SentenceDebugData {
    /** Number of sensor samples that fell within this sentence's time window */
    sliceSampleCount: number;
    /** WPM calculated from Deepgram word timestamps */
    trueWpm: number;
    /** Total words in the sentence */
    wordCount: number;
    /** Average pitch across the sentence */
    avgPitch: number;
    /** Pitch range (max - min) in Hz */
    pitchRange: number;
    /** Average volume */
    avgVolume: number;
    /** Average Deepgram confidence (0-1) */
    clarityScore: number;
    /** Words below the clarity threshold */
    mumbledWords: { word: string; confidence: number }[];
    /** Deepgram stream epoch (Unix ms) */
    streamEpoch: number;
}

/**
 * SentenceAnalytics is the finalized "Record of Truth" for a completed sentence.
 * Replaces the old TurnAnalytics — same shape, finer granularity.
 */
export interface SentenceAnalytics {
    /** Global Unix timestamp of when the sentence started */
    timestamp: number;
    /** The full text of the sentence */
    transcript: string;
    /** Tags generated from physics + clarity analysis */
    tags: string[];
    /** Per-word physics mapping */
    wordMetrics: WordMetrics[];
    /** Technical data for the Analytics Debug Dashboard */
    debug: SentenceDebugData;
}

// Keep backward-compatible export name for AnalyticsDebugPanel
export type TurnAnalytics = SentenceAnalytics;

// ============================================================
//  HOOK
// ============================================================

/**
 * useVoiceAnalyticsEngine — converts real-time signals into per-sentence analytics.
 *
 * Architecture:
 * 1. Sensor buffer collects pitch/volume every ~16ms with system timestamps.
 * 2. Gemini Live emits qualitative delivery tags whenever the user pauses
 *    or finishes a thought.
 * 3. Each new tag batch is recorded as a SentenceAnalytics trace and surfaced
 *    in `preliminaryTags` for the live HUD.
 *
 * @param sensorMetrics - Real-time metrics from useSensorMetrics
 * @param isStreaming - Whether the session is active
 * @param liveTags - Streaming tag batches from Gemini Live
 */
export function useVoiceAnalyticsEngine(
    sensorMetrics: SensorMetrics | null,
    isStreaming: boolean,
    liveTags: LiveTags[]
) {
    // --- Sensor buffer: pitch/volume with system timestamps ---
    const sensorBuffer = useRef<{ volume: number; pitch: number; timestamp: number }[]>([]);

    // --- Output state ---
    const [analyticsTraces, setAnalyticsTraces] = useState<SentenceAnalytics[]>([]);
    const [preliminaryTags, setPreliminaryTags] = useState<string[]>([]);

    // Track how many tag batches we've processed to avoid re-processing
    const processedTagCount = useRef(0);

    // ========================================================
    //  EFFECT: Reset on session start/stop
    // ========================================================
    useEffect(() => {
        if (!isStreaming) {
            sensorBuffer.current = [];
            processedTagCount.current = 0;
            queueMicrotask(() => {
                setAnalyticsTraces([]);
                setPreliminaryTags([]);
            });
        }
    }, [isStreaming]);

    // ========================================================
    //  EFFECT: Continuously sample sensor data
    // ========================================================
    useEffect(() => {
        if (isStreaming && sensorMetrics) {
            sensorBuffer.current.push({
                volume: sensorMetrics.volume,
                pitch: sensorMetrics.pitch,
                timestamp: Date.now(),
            });
            // Cap buffer at 20k samples (~5 minutes at 16ms intervals)
            if (sensorBuffer.current.length > 20000) {
                sensorBuffer.current = sensorBuffer.current.slice(-10000);
            }
        }
    }, [sensorMetrics, isStreaming]);

    // ========================================================
    //  EFFECT: Process new Gemini Live Tags
    // ========================================================
    useEffect(() => {
        if (liveTags.length <= processedTagCount.current) return;

        const newTags = liveTags.slice(processedTagCount.current);
        processedTagCount.current = liveTags.length;

        const now = Date.now();
        const newAnalytics: SentenceAnalytics[] = [];

        for (const tagBatch of newTags) {
            if (tagBatch.tags.length === 0) continue;

            const analytics: SentenceAnalytics = {
                timestamp: now,
                transcript: "[Gemini Live Tag Event]",
                tags: tagBatch.tags,
                wordMetrics: [],
                debug: {
                    sliceSampleCount: 0,
                    trueWpm: 0,
                    wordCount: 0,
                    avgPitch: 0,
                    pitchRange: 0,
                    avgVolume: 0,
                    clarityScore: 0,
                    mumbledWords: [],
                    streamEpoch: 0,
                }
            };

            newAnalytics.push(analytics);
            
            // Add tags to preliminary list for UI display
            setPreliminaryTags(prev => {
                const updated = [...prev, ...tagBatch.tags];
                return updated.slice(-6); // Keep last 6 tags
            });

            console.log(
                '%c[Gemini Live] 🏷️ Voice Tags injected:',
                'color: #d946ef; font-weight: bold;',
                tagBatch.tags.join(' | ')
            );
        }

        if (newAnalytics.length > 0) {
            setAnalyticsTraces(prev => [...prev, ...newAnalytics]);
        }
    }, [liveTags]);

    return {
        analyticsTraces,
        preliminaryTags,
        clearPreliminaryTags: () => setPreliminaryTags([]),
    };
}
