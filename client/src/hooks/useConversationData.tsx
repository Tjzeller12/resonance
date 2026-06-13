import { useCallback, useRef, useState } from 'react';
import type { SentenceAnalytics } from './useVoiceAnalyticsEngine';
import type {
    ConversationPayload,
    HumeTranscriptMessage,
    AnalysisResult,
    AnalyzeResponse,
    StageProgressionEntry,
} from '../types/conversationAnalysis';
import { toServerAnalytics } from '../types/conversationAnalysis';
import { ANALYZE_URL } from '../config';
import { getScenarioMode } from '../data/scenarios';

// ============================================================
//  TYPES
// ============================================================

/**
 * Minimal Hume EVI message shape.
 * We only extract what we need from the SDK's rich message objects.
 */
interface HumeMessageLike {
    type: string;
    message?: {
        role: string;
        content: string;
    };
    models?: {
        prosody?: {
            scores?: Record<string, number>;
        };
    };
    receivedAt?: Date;
}

// ============================================================
//  HOOK
// ============================================================

/**
 * useConversationData — The Compositor Hook
 *
 * Subscribes to the outputs of all session hooks and accumulates a unified
 * dataset over the lifetime of a session. On session end, it bundles
 * everything into a typed ConversationPayload and submits it to the
 * server for post-match analysis.
 *
 * Design:
 * - This hook does NOT own any data sources. It reads from existing hooks.
 * - It maintains its own timestamps and stage timeline.
 * - It exposes `getPayload()` for manual snapshots and `submitForAnalysis()`
 *   for the automatic post-match flow.
 * - `flush()` resets accumulators for future turn-by-turn use.
 *
 * @param scenarioId - The current scenario identifier
 * @param messages - Hume EVI message array (from useEviManager)
 * @param analyticsTraces - Sentence analytics (from useVoiceAnalyticsEngine)
 * @param pitchHistory - Downsampled pitch timeline (from useSimulationSession)
 * @param sensorVolume - Latest volume reading for summary (from useSensorMetrics)
 */
export function useConversationData(
    scenarioId: string,
    messages: unknown[],
    analyticsTraces: SentenceAnalytics[],
    pitchHistory: number[],
    sensorVolume: number,
) {
    // ── Session Lifecycle ──
    const sessionStartedAt = useRef<number>(0);
    const sessionEndedAt = useRef<number>(0);
    const sessionId = useRef<string>('');

    // ── Stage Timeline ──
    const stageTimeline = useRef<StageProgressionEntry[]>([]);

    // ── Analysis State ──
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    // ── Session Duration (state, safe to read during render) ──
    const [sessionDurationMs, setSessionDurationMs] = useState(0);

    /**
     * markSessionStart: Call when the session begins.
     * Records the start timestamp and generates a session ID.
     */
    const markSessionStart = useCallback(() => {
        sessionStartedAt.current = Date.now();
        sessionId.current = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        stageTimeline.current = [];
        setAnalysisResult(null);
        setAnalysisError(null);
        console.log(
            '%c[ConversationData] 📍 Session started',
            'color: #3b82f6; font-weight: bold;',
            sessionId.current
        );
    }, []);

    /**
     * markSessionEnd: Call when the session ends.
     * Records the end timestamp.
     */
    const markSessionEnd = useCallback(() => {
        sessionEndedAt.current = Date.now();
        const duration = sessionEndedAt.current - sessionStartedAt.current;
        setSessionDurationMs(duration);
        console.log(
            '%c[ConversationData] 🏁 Session ended',
            'color: #3b82f6; font-weight: bold;',
            `${(duration / 1000).toFixed(1)}s`
        );
    }, []);

    /**
     * recordStageTransition: Call when a stage advances.
     * Closes the previous stage and opens a new one.
     */
    const recordStageTransition = useCallback(
        (stageId: string, title: string) => {
            const now = Date.now();

            // Close the previous stage if one exists
            const timeline = stageTimeline.current;
            if (timeline.length > 0) {
                const last = timeline[timeline.length - 1];
                if (!last.ended_at) {
                    last.ended_at = now;
                }
            }

            // Open the new stage
            timeline.push({
                stage_id: stageId,
                title,
                started_at: now,
            });

            console.log(
                '%c[ConversationData] ➡️ Stage transition',
                'color: #8b5cf6; font-weight: bold;',
                `${stageId}: "${title}"`
            );
        },
        []
    );

    /**
     * extractHumeTranscript: Converts Hume SDK message objects into
     * the simplified format needed for the analysis payload.
     */
    const extractHumeTranscript = useCallback((): HumeTranscriptMessage[] => {
        const transcript: HumeTranscriptMessage[] = [];

        for (const raw of messages) {
            const msg = raw as HumeMessageLike;

            // We only care about user and assistant messages with content
            if (
                (msg.type === 'user_message' || msg.type === 'assistant_message') &&
                msg.message?.content
            ) {
                const entry: HumeTranscriptMessage = {
                    role: msg.message.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.message.content,
                    timestamp: msg.receivedAt ? msg.receivedAt.getTime() : Date.now(),
                };

                // Extract top prosody emotions (if available, user messages only)
                if (msg.type === 'user_message' && msg.models?.prosody?.scores) {
                    const scores = msg.models.prosody.scores;
                    const sorted = Object.entries(scores)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5);

                    entry.prosody = {
                        top_emotions: sorted.map(([name, score]) => ({ name, score })),
                    };
                }

                transcript.push(entry);
            }
        }

        return transcript;
    }, [messages]);

    /**
     * getPayload: Snapshots all accumulated data into a typed ConversationPayload.
     * Can be called at any point to get the current state — does not mutate anything.
     */
    const getPayload = useCallback((): ConversationPayload => {
        // Compute sensor summary from available data
        const validPitches = pitchHistory.filter(p => p > 60);
        const avgPitch =
            validPitches.length > 0
                ? validPitches.reduce((s, v) => s + v, 0) / validPitches.length
                : 0;

        // Determine mode from scenario
        const mode = getScenarioMode(scenarioId);

        // Close any open stage
        const timeline = [...stageTimeline.current];
        if (timeline.length > 0) {
            const last = timeline[timeline.length - 1];
            if (!last.ended_at) {
                last.ended_at = sessionEndedAt.current || Date.now();
            }
        }

        return {
            session_id: sessionId.current || `session_${Date.now()}`,
            scenario_id: scenarioId,
            mode,
            started_at: sessionStartedAt.current,
            ended_at: sessionEndedAt.current || Date.now(),
            hume_transcript: extractHumeTranscript(),
            deepgram_analytics: analyticsTraces.map(toServerAnalytics),
            sensor_summary: {
                avg_pitch: Math.round(avgPitch * 10) / 10,
                avg_volume: Math.round(sensorVolume * 1000) / 1000,
                total_duration_ms: (sessionEndedAt.current || Date.now()) - sessionStartedAt.current,
            },
            stage_progression: timeline,
        };
    }, [
        scenarioId,
        analyticsTraces,
        pitchHistory,
        sensorVolume,
        extractHumeTranscript,
    ]);

    /**
     * submitForAnalysis: Bundles all session data and POSTs to /api/analyze.
     * Updates analysisResult state when the server responds.
     */
    const submitForAnalysis = useCallback(async (): Promise<AnalysisResult | null> => {
        setIsAnalyzing(true);
        setAnalysisError(null);

        const payload = getPayload();

        console.log(
            '%c[ConversationData] 📤 Submitting for analysis',
            'color: #f59e0b; font-weight: bold;',
            {
                messages: payload.hume_transcript.length,
                sentences: payload.deepgram_analytics.length,
                stages: payload.stage_progression.length,
                duration: `${((payload.ended_at - payload.started_at) / 1000).toFixed(1)}s`,
            }
        );

        try {
            const response = await fetch(ANALYZE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            // Axum returns plain text for deserialization errors (422),
            // so we must check the content type before parsing as JSON.
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ConversationData] ❌ Server error ${response.status}:`, errorText);
                setAnalysisError(`Server error ${response.status}: ${errorText}`);
                setIsAnalyzing(false);
                return null;
            }

            const result = (await response.json()) as AnalyzeResponse;

            if (result.success && result.data) {
                console.log(
                    '%c[ConversationData] ✅ Analysis complete',
                    'color: #10b981; font-weight: bold;',
                    `${result.data.total_xp} XP | ${result.data.highlights.length} highlights`
                );
                setAnalysisResult(result.data);
                setIsAnalyzing(false);
                return result.data;
            } else {
                const errorMsg = result.error || 'Unknown analysis error';
                console.error('[ConversationData] ❌ Analysis failed:', errorMsg);
                setAnalysisError(errorMsg);
                setIsAnalyzing(false);
                return null;
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Network error';
            console.error('[ConversationData] ❌ Request failed:', errorMsg);
            setAnalysisError(errorMsg);
            setIsAnalyzing(false);
            return null;
        }
    }, [getPayload]);

    /**
     * flush: Resets all accumulators for a fresh collection cycle.
     * Useful for future turn-by-turn training where you want to
     * analyze and then reset between turns.
     */
    const flush = useCallback(() => {
        sessionStartedAt.current = 0;
        sessionEndedAt.current = 0;
        sessionId.current = '';
        stageTimeline.current = [];
        setAnalysisResult(null);
        setAnalysisError(null);
        setSessionDurationMs(0);
    }, []);

    /**
     * clearAnalysis: Resets only the analysis state without touching
     * session accumulators. Used by the "Try Again" flow to return
     * to the simulation-ready view.
     */
    const clearAnalysis = useCallback(() => {
        setAnalysisResult(null);
        setAnalysisError(null);
    }, []);

    return {
        // Lifecycle
        markSessionStart,
        markSessionEnd,
        recordStageTransition,

        // Data access
        getPayload,
        submitForAnalysis,
        flush,
        clearAnalysis,

        // State
        analysisResult,
        isAnalyzing,
        analysisError,

        // Session metadata (for PostMatchReport)
        sessionDurationMs,
    };
}
