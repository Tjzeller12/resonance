import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from './common/Card';
import EviConvoPanel from './eviConvoPanel';
import SensorMetricsPanel from './SensorMetricsPanel';
import SimControlPanel from './SimControlPanel';
import AnalyticsDebugPanel from './AnalyticsDebugPanel';
import { useEviManager } from '../hooks/useEviManager';
import { useSimulationSession } from '../hooks/useSimulationSession';
import { useStageDirector } from '../hooks/useStageDirector';
import { useVoiceAnalyticsEngine } from '../hooks/useVoiceAnalyticsEngine';
import { useConversationData } from '../hooks/useConversationData';


interface SimulationInnerProps {
    /**
     * A ref passed from the parent (Simulation) that allows the parent to trigger
     * a stage advancement when the AI invokes a specific tool call.
     */
    advanceStageRef: React.MutableRefObject<(() => void) | null>;
}

/**
 * SimulationInner contains the heart of the "Resonance" experience.
 * 
 * It manages three parallel systems:
 * 1. The Rust Audio Session (Raw audio physics & metrics)
 * 2. The Hume EVI Session (The AI persona & voice)
 * 3. The Stage Director (Managing the flow of a multi-part scenario)
 */
const SimulationInner = ({ advanceStageRef }: SimulationInnerProps) => {
    // 1. Rust Audio/Physics Session
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, wordBatches, startSession, endSession } = useSimulationSession();
    
    // 2. Hume EVI Session (Brain)
    const { startEviSession, stopEviSession, messages, activeConfig, status, sendSessionSettings } = useEviManager();
    
    // Check if either the raw audio stream or the AI connection is active
    const isStreaming = sessionStatus === 'active' || status.value === 'connected';

    // 3. Stage Director (The "Script" of the simulation)
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || '';
    const director = useStageDirector(scenarioId, sendSessionSettings as (settings: Record<string, unknown>) => void);

    // 4. Voice Analytics Engine (Word-Level Sensor Fusion)
    // Maps Deepgram word events to pitch/volume sensor data per-sentence.
    const { analyticsTraces, preliminaryTags } = useVoiceAnalyticsEngine(messages, sensorMetrics, isStreaming, wordBatches);

    // 5. Conversation Data Compositor (Post-Match Analysis)
    // Accumulates all session data and handles the analysis submission flow.
    const {
        markSessionStart,
        markSessionEnd,
        recordStageTransition,
        submitForAnalysis,
        analysisResult,
        isAnalyzing,
        analysisError,
    } = useConversationData(
        scenarioId,
        messages,
        analyticsTraces,
        pitchHistory,
        sensorMetrics?.volume ?? 0,
    );

    // 6. WPM: Sourced from the latest finalized analytics trace (Deepgram ground-truth)
    const latestTrace = analyticsTraces[analyticsTraces.length - 1];
    const displayWpm = latestTrace?.debug?.trueWpm ?? 0;

    /**
     * SENSOR FUSION: Context Injection
     * This is where the magic happens. The instant the user stops speaking, 
     * `preliminaryTags` are generated (e.g., "Fast Pacing", "High Pitch Variance").
     * 
     * We immediately inject these tags into the AI's short-term memory (Context)
     * so it can react to your delivery in its VERY NEXT sentence.
     */
    useEffect(() => {
        if (preliminaryTags.length > 0) {
            const telemetryPayload = `[SYSTEM TELEMETRY DATA FOR THE USER'S LAST MESSAGE - Tags: ${preliminaryTags.join(' | ')}]`;
            try {
                sendSessionSettings({
                    context: {
                        text: telemetryPayload,
                        type: 'persistent'
                    }
                });
                console.log('%c[Context Injection] ⚡ PRELIMINARY', 'color: #a855f7; font-weight: bold;', telemetryPayload);
            } catch (e) {
                console.warn('[Context Injection] Failed to send telemetry', e);
            }
        }
    }, [preliminaryTags, sendSessionSettings]);

    /**
     * Component Communication:
     * We "expose" the director's advanceStage function to the parent via the ref.
     * This allows the Parent's `VoiceProvider` (which hears all AI tool calls)
     * to call `director.advanceStage()` when the AI decides it's time to move on.
     * 
     * We also record stage transitions in the conversation data compositor.
     */
    useEffect(() => {
        if (advanceStageRef) {
            const originalAdvance = director.advanceStage;
            advanceStageRef.current = () => {
                // Record the transition before advancing
                const nextIndex = director.stageIndex + 1;
                const nextStage = director.stages[nextIndex];
                if (nextStage) {
                    recordStageTransition(nextStage.id, nextStage.title);
                }
                originalAdvance();
            };
        }
    }, [director.advanceStage, director.stageIndex, director.stages, advanceStageRef, recordStageTransition]);

    const handleStart = () => {
        markSessionStart();

        // Record initial stage if this is a staged simulation
        if (director.isStaged && director.currentStage) {
            recordStageTransition(director.currentStage.id, director.currentStage.title);
        }

        void startSession(); // Starts the Rust WebSocket
        void startEviSession(); // Starts the Hume WebSocket
    };

    const handleEnd = async () => {
        markSessionEnd();
        void endSession();
        stopEviSession();

        // Auto-submit for post-match analysis
        const result = await submitForAnalysis();
        if (result) {
            console.log(
                '%c[SimulationInner] 📊 Post-match report ready',
                'color: #10b981; font-weight: bold; font-size: 14px;',
                {
                    totalXp: result.total_xp,
                    categories: result.category_scores.map(c => `${c.category}: ${c.score}`),
                    highlights: result.highlights.length,
                }
            );
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4 sm:p-6">
            <Card title="Simulation" className="w-full max-w-screen-2xl flex flex-col p-4 shadow-2xl">
                
                {/* Main Stage (21:9 Cinematic Image + HUD Overlay) */}
                <div className="relative w-full aspect-video md:aspect-21/9 rounded-xl overflow-hidden border border-neutral-700/50 bg-black shadow-inner">
                    {/* The visual persona and transcript panel */}
                    <EviConvoPanel messages={messages} imageUrl={activeConfig.image} />
                    
                    {/* HUD: Telemetry (Top Right Overlay) */}
                    <div className="absolute top-4 right-4 w-64 z-20 pointer-events-none">
                        <SensorMetricsPanel metrics={sensorMetrics} pitchHistory={pitchHistory} wpm={displayWpm} />
                    </div>

                    {/* Stage Indicator: Shows what part of the "Interview" or "Scenario" you are in */}
                    {director.isStaged && director.currentStage && (
                        <div className="absolute top-[150px] left-4 w-64 z-20 pointer-events-none">
                            <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/30 rounded-xl px-4 py-3 shadow-lg shadow-emerald-900/20">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        Stage {director.stageIndex + 1} of {director.totalStages}
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-white leading-tight">
                                    {director.currentStage.title}
                                </div>
                                {director.currentStage.duration_hint && (
                                    <div className="text-xs text-neutral-400 mt-1.5 pt-1.5 border-t border-neutral-700/50 font-medium">
                                        {director.currentStage.duration_hint}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Post-Match Analysis Status Overlay */}
                    {isAnalyzing && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                            <div className="bg-neutral-900/90 border border-blue-500/30 rounded-2xl px-8 py-6 shadow-2xl text-center">
                                <div className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
                                <div className="text-sm font-bold text-blue-400 uppercase tracking-widest">Analyzing Performance</div>
                                <div className="text-xs text-neutral-400 mt-2">Generating your post-match report...</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Post-Match Results Preview */}
                {analysisResult && (
                    <div className="w-full mt-4 p-4 bg-neutral-800/50 border border-emerald-500/20 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                                📊 Post-Match Report
                            </div>
                            <div className="text-2xl font-bold text-white">
                                {analysisResult.total_xp} <span className="text-sm text-emerald-400">XP</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
                            {analysisResult.category_scores.map((cat) => (
                                <div key={cat.category} className="bg-neutral-900/50 rounded-lg p-2 text-center">
                                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider truncate">{cat.category}</div>
                                    <div className={`text-lg font-bold mt-0.5 ${
                                        cat.score >= 80 ? 'text-emerald-400' :
                                        cat.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                    }`}>
                                        {cat.score}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                            {analysisResult.overall_feedback}
                        </p>
                    </div>
                )}

                {/* Analysis Error */}
                {analysisError && (
                    <div className="w-full mt-4 p-3 bg-red-950/30 border border-red-500/30 rounded-xl">
                        <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Analysis Failed</div>
                        <p className="text-xs text-red-300">{analysisError}</p>
                    </div>
                )}

                {/* Bottom: Start/Stop controls */}
                <div className="w-full mt-6 pt-6 border-t border-neutral-800">
                    <SimControlPanel
                        isConnected={isConnected}
                        isStreaming={isStreaming}
                        onStart={() => { handleStart(); }}
                        onEnd={() => { void handleEnd(); }}
                    />
                </div>

            </Card>

            {/* Debug Dashboard (Hidden in production, shows raw AI reasoning/traces) */}
            <AnalyticsDebugPanel traces={analyticsTraces} />
        </div>
    );
};

export default SimulationInner;
