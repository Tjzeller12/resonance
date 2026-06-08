// ─── Shared types for the Post-Match Analysis Engine ────────────────────────

import type { SentenceAnalytics } from '../hooks/useVoiceAnalyticsEngine';

// ─── Payload: Client → Server ───────────────────────────────────────────────

/** The full session payload sent to /api/analyze after a session ends. */
export interface ConversationPayload {
    /** Unique session identifier */
    session_id: string;
    /** Scenario that was played (e.g. "tech_interview", "bar") */
    scenario_id: string;
    /** Session mode */
    mode: 'evi_sim' | 'training' | 'dojo';
    /** Unix ms timestamp when the session started */
    started_at: number;
    /** Unix ms timestamp when the session ended */
    ended_at: number;
    /** Full conversation transcript from Hume EVI */
    hume_transcript: HumeTranscriptMessage[];
    /** Per-sentence analytics traces from the voice analytics engine */
    deepgram_analytics: DeepgramAnalyticsEntry[];
    /** Aggregated sensor data for the session */
    sensor_summary: SensorSummary;
    /** Stage progression timeline (for staged simulations) */
    stage_progression: StageProgressionEntry[];
}

/** A single message extracted from Hume EVI's message stream. */
export interface HumeTranscriptMessage {
    /** "user" or "assistant" */
    role: string;
    /** The spoken text */
    content: string;
    /** Unix ms timestamp */
    timestamp: number;
    /** Top prosody/emotion scores (if available) */
    prosody?: {
        top_emotions: Array<{ name: string; score: number }>;
    };
}

/**
 * Per-sentence analytics entry sent to the server.
 * Mirrors the SentenceAnalytics shape but with snake_case keys for Rust.
 */
export interface DeepgramAnalyticsEntry {
    timestamp: number;
    transcript: string;
    tags: string[];
    word_metrics: Array<{
        word: string;
        confidence: number;
        avg_pitch: number;
        avg_volume: number;
        start: number;
        end: number;
    }>;
    debug: {
        true_wpm: number;
        word_count: number;
        avg_pitch: number;
        pitch_range: number;
        avg_volume: number;
        clarity_score: number;
        mumbled_words: Array<{ word: string; confidence: number }>;
    };
}

export interface SensorSummary {
    avg_pitch: number;
    avg_volume: number;
    total_duration_ms: number;
}

export interface StageProgressionEntry {
    stage_id: string;
    title: string;
    started_at: number;
    ended_at?: number;
}

// ─── Response: Server → Client ──────────────────────────────────────────────

/** API response from /api/analyze */
export interface AnalyzeResponse {
    success: boolean;
    data?: AnalysisResult;
    error?: string;
}

/** The structured analysis returned by the server. */
export interface AnalysisResult {
    /** Per-category scores with justifications */
    category_scores: CategoryScore[];
    /** Weighted total XP earned */
    total_xp: number;
    /** Best and worst moments from the session */
    highlights: Highlight[];
    /** Recommended next training modules */
    suggested_training: SuggestedTraining[];
    /** Narrative summary of performance */
    overall_feedback: string;
}

export interface CategoryScore {
    /** Category name (matches rubric) */
    category: string;
    /** Score 0-100 */
    score: number;
    /** Weight from the rubric (0.0 - 1.0) */
    weight: number;
    /** LLM-generated justification */
    justification: string;
}

export interface Highlight {
    /** "strength" or "weakness" */
    highlight_type: 'strength' | 'weakness';
    /** The moment's transcript snippet */
    transcript_snippet: string;
    /** Unix ms timestamp of the moment */
    timestamp: number;
    /** Why this moment was notable */
    explanation: string;
    /** Optional recommendation of what to say or do instead */
    suggestion?: string;
}

export interface SuggestedTraining {
    /** Scenario ID of the recommended module */
    module_id: string;
    /** Human-readable module name */
    module_name: string;
    /** Why this module is recommended */
    reason: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Converts a SentenceAnalytics (camelCase, from the engine) to a
 * DeepgramAnalyticsEntry (snake_case, for the server).
 */
export function toServerAnalytics(sentence: SentenceAnalytics): DeepgramAnalyticsEntry {
    return {
        timestamp: Math.round(sentence.timestamp),
        transcript: sentence.transcript,
        tags: sentence.tags,
        word_metrics: sentence.wordMetrics.map(w => ({
            word: w.word,
            confidence: w.confidence,
            avg_pitch: w.avgPitch,
            avg_volume: w.avgVolume,
            start: w.start,
            end: w.end,
        })),
        debug: {
            true_wpm: sentence.debug.trueWpm,
            word_count: sentence.debug.wordCount,
            avg_pitch: sentence.debug.avgPitch,
            pitch_range: sentence.debug.pitchRange,
            avg_volume: sentence.debug.avgVolume,
            clarity_score: sentence.debug.clarityScore,
            mumbled_words: sentence.debug.mumbledWords,
        },
    };
}
