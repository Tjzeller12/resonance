import { useEffect, useRef, useState } from 'react';
import { calculatePitchRange, calculatePitchTrend, calculateVolumeTags } from '../utils/audioAnalysis';
import type { SensorMetrics, WordBatch, WordData } from './useSensorMetrics';

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
//  CONSTANTS
// ============================================================

/** Confidence below this flags a word as "mumbled" */
const CLARITY_THRESHOLD = 0.75;

/** If more than this ratio of words are mumbled, the whole sentence is "unclear" */
const MUMBLE_RATIO_THRESHOLD = 0.20;

// ============================================================
//  HOOK
// ============================================================

/**
 * useVoiceAnalyticsEngine — Word-Level Sensor Fusion
 *
 * Architecture:
 * 1. Sensor buffer collects pitch/volume every ~16ms with system timestamps.
 * 2. Deepgram streaming sends WordBatch events with per-word audio timestamps.
 * 3. When Deepgram detects a sentence boundary (speech_final), this engine:
 *    - Maps each word to its sensor data using the stream epoch.
 *    - Calculates WPM from word timestamps.
 *    - Generates tags for pitch, volume, pace, and clarity.
 *
 * @param messages   - Hume EVI messages (used for prosody only)
 * @param sensorMetrics - Real-time metrics from useSensorMetrics
 * @param isStreaming - Whether the session is active
 * @param wordBatches - Streaming word batches from Deepgram
 */
export function useVoiceAnalyticsEngine(
    messages: unknown[],
    sensorMetrics: SensorMetrics | null,
    isStreaming: boolean,
    wordBatches: WordBatch[]
) {
    // --- Sensor buffer: pitch/volume with system timestamps ---
    const sensorBuffer = useRef<{ volume: number; pitch: number; timestamp: number }[]>([]);

    // --- Output state ---
    const [analyticsTraces, setAnalyticsTraces] = useState<SentenceAnalytics[]>([]);
    const [preliminaryTags, setPreliminaryTags] = useState<string[]>([]);

    // Track how many word batches we've processed to avoid re-processing
    const processedBatchCount = useRef(0);

    // Accumulate words across batches until a sentence boundary (punctuation) is detected
    const pendingWords = useRef<{ word: WordData; epoch: number }[]>([]);

    // ========================================================
    //  EFFECT: Reset on session start/stop
    // ========================================================
    useEffect(() => {
        if (!isStreaming) {
            sensorBuffer.current = [];
            processedBatchCount.current = 0;
            pendingWords.current = [];
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
    //  EFFECT: Process new word batches → sentence analytics
    // ========================================================
    useEffect(() => {
        if (wordBatches.length <= processedBatchCount.current) return;

        // Process only new batches
        const newBatches = wordBatches.slice(processedBatchCount.current);
        processedBatchCount.current = wordBatches.length;

        const completedSentences: SentenceAnalytics[] = [];

        for (const batch of newBatches) {
            for (const w of batch.words) {
                pendingWords.current.push({ word: w, epoch: batch.stream_epoch_ms });
            }

            // Sentence boundary = transcript ends with . ? or !
            // Deepgram's smart_format puts punctuation accurately,
            // so we trust it instead of speech_final (which fires on any pause).
            const trimmed = batch.transcript.trim();
            const lastChar = trimmed[trimmed.length - 1];
            const isSentenceEnd = lastChar === '.' || lastChar === '?' || lastChar === '!';

            if (isSentenceEnd && pendingWords.current.length > 0) {
                const sentence = buildSentenceAnalytics(
                    [...pendingWords.current],
                    sensorBuffer.current
                );
                if (sentence) {
                    completedSentences.push(sentence);

                    queueMicrotask(() => {
                        setPreliminaryTags(sentence.tags);
                    });

                    console.log(
                        '%c[VoiceAnalytics] ✅ SENTENCE',
                        'color: #10b981; font-weight: bold;',
                        `"${sentence.transcript}" | ${sentence.debug.trueWpm} WPM | ${sentence.tags.join(' | ')}`
                    );
                }
                pendingWords.current = [];
            }
        }

        if (completedSentences.length > 0) {
            queueMicrotask(() => {
                setAnalyticsTraces(prev => [...prev, ...completedSentences]);
            });
        }
    }, [wordBatches]);

    return { analyticsTraces, preliminaryTags };
}

// ============================================================
//  SENTENCE BUILDER
// ============================================================

/**
 * Maps each word to sensor buffer data and generates analytics for a sentence.
 */
function buildSentenceAnalytics(
    words: { word: WordData; epoch: number }[],
    sensorBuffer: { volume: number; pitch: number; timestamp: number }[]
): SentenceAnalytics | null {
    if (words.length === 0) return null;

    const epoch = words[0].epoch;
    const transcript = words.map(w => w.word.word).join(' ');

    // Map each word to its sensor data
    const wordMetrics: WordMetrics[] = words.map(({ word }) => {
        const wordStartMs = epoch + word.start * 1000;
        const wordEndMs = epoch + word.end * 1000;

        // Look up sensor buffer for this word's time window
        const slice = sensorBuffer.filter(
            m => m.timestamp >= wordStartMs && m.timestamp <= wordEndMs
        );

        const pitches = slice.filter(m => m.pitch > 60).map(m => m.pitch);
        const volumes = slice.filter(m => m.volume > 0).map(m => m.volume);

        return {
            word: word.word,
            confidence: word.confidence,
            avgPitch: pitches.length > 0
                ? Math.round(pitches.reduce((s, v) => s + v, 0) / pitches.length)
                : 0,
            avgVolume: volumes.length > 0
                ? Math.round((volumes.reduce((s, v) => s + v, 0) / volumes.length) * 1000) / 1000
                : 0,
            start: word.start,
            end: word.end,
        };
    });

    // --- Aggregate metrics ---
    const firstWord = words[0].word;
    const lastWord = words[words.length - 1].word;
    const durationMinutes = (lastWord.end - firstWord.start) / 60;
    const trueWpm = durationMinutes > 0 ? Math.round(words.length / durationMinutes) : 0;

    const sentenceStartMs = epoch + firstWord.start * 1000;
    const sentenceEndMs = epoch + lastWord.end * 1000;

    // Get the full sensor slice for the sentence (for trend analysis)
    const fullSlice = sensorBuffer.filter(
        m => m.timestamp >= sentenceStartMs && m.timestamp <= sentenceEndMs
    );

    const validPitches = fullSlice.filter(m => m.pitch > 60).map(m => m.pitch);
    const avgPitch = validPitches.length > 0
        ? Math.round(validPitches.reduce((s, v) => s + v, 0) / validPitches.length) : 0;

    const validVolumes = fullSlice.filter(m => m.volume > 0).map(m => m.volume);
    const avgVolume = validVolumes.length > 0
        ? Math.round((validVolumes.reduce((s, v) => s + v, 0) / validVolumes.length) * 1000) / 1000 : 0;

    // Clarity
    const totalConfidence = words.reduce((s, w) => s + w.word.confidence, 0);
    const rawClarity = totalConfidence / words.length;
    const mumbledWords = words
        .filter(w => w.word.confidence < CLARITY_THRESHOLD)
        .map(w => ({ word: w.word.word, confidence: w.word.confidence }));

    const mumbleRatio = mumbledWords.length / words.length;
    const clarityScore = mumbleRatio > MUMBLE_RATIO_THRESHOLD
        ? Math.min(rawClarity * 0.5, 0.60)
        : mumbledWords.length > 0
            ? rawClarity * (1 - mumbleRatio * 2)
            : rawClarity;

    // --- Tag Generation ---
    const tags: string[] = [];

    // 1. Pitch inflection & range
    const pitchTrend = calculatePitchTrend(fullSlice);
    if (pitchTrend === 'downward') tags.push('Downward inflection');
    if (pitchTrend === 'upward') tags.push('Upward inflection');

    const pitchRange = calculatePitchRange(fullSlice);
    if (pitchRange > 40) tags.push(`Dynamic Pitch (Range: ${pitchRange}Hz)`);
    else if (pitchRange > 0 && pitchRange < 35) tags.push(`Monotone (Range: ${pitchRange}Hz)`);

    // 2. Volume tags
    tags.push(...calculateVolumeTags(fullSlice));

    // 3. Pace (from Deepgram ground-truth WPM)
    if (trueWpm > 190) tags.push(`Pace is extremely fast (${trueWpm} WPM)`);
    else if (trueWpm > 160) tags.push(`Pace is fast (${trueWpm} WPM)`);
    else if (trueWpm > 120) tags.push(`Pace is medium (${trueWpm} WPM)`);
    else if (trueWpm > 80) tags.push(`Pace is slow (${trueWpm} WPM)`);
    else if (trueWpm > 0) tags.push(`Pace is very slow (${trueWpm} WPM)`);

    // 4. Clarity
    if (clarityScore < 0.70) {
        tags.push(`Speech unclear (${Math.round(clarityScore * 100)}% clarity)`);
    }
    if (mumbledWords.length > 0) {
        tags.push(`Mumbled: ${mumbledWords.map(w => `"${w.word}"`).join(', ')}`);
    }

    return {
        timestamp: sentenceStartMs,
        transcript,
        tags,
        wordMetrics,
        debug: {
            sliceSampleCount: fullSlice.length,
            trueWpm,
            wordCount: words.length,
            avgPitch,
            pitchRange,
            avgVolume,
            clarityScore: Math.round(clarityScore * 100) / 100,
            mumbledWords,
            streamEpoch: epoch,
        },
    };
}
