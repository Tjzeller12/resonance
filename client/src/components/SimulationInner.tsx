import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useConversationData } from '../hooks/useConversationData';
import { useEviManager } from '../hooks/useEviManager';
import { useSimulationSession } from '../hooks/useSimulationSession';
import { useStageDirector } from '../hooks/useStageDirector';
import { useVoiceAnalyticsEngine } from '../hooks/useVoiceAnalyticsEngine';
import AnalyticsDebugPanel from './AnalyticsDebugPanel';
import Card from './common/Card';
import EviConvoPanel from './EviConvoPanel';
import PostMatchReport from './postmatch/PostMatchReport';
import SensorMetricsPanel from './SensorMetricsPanel';
import SimControlPanel from './SimControlPanel';


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
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, liveTags, startSession, endSession } = useSimulationSession();
    
    // 2. Hume EVI Session (Brain)
    const { startEviSession, stopEviSession, messages, activeConfig, status, sendSessionSettings } = useEviManager();
    
    // Check if either the raw audio stream or the AI connection is active
    const isStreaming = sessionStatus === 'active' || status.value === 'connected';

    // 3. Stage Director (The "Script" of the simulation)
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || '';
    const director = useStageDirector(scenarioId, sendSessionSettings as (settings: Record<string, unknown>) => void);

    // 4. Voice Analytics Engine
    // Converts Gemini Live tag events + sensor data into per-sentence analytics.
    const { analyticsTraces, preliminaryTags } = useVoiceAnalyticsEngine(sensorMetrics, isStreaming, liveTags);

    // 5. Conversation Data Compositor (Post-Match Analysis)
    // Accumulates all session data and handles the analysis submission flow.
    const {
        markSessionStart,
        markSessionEnd,
        recordStageTransition,
        submitForAnalysis,
        clearAnalysis,
        flush,
        analysisResult,
        isAnalyzing,
        analysisError,
        sessionDurationMs,
    } = useConversationData(
        scenarioId,
        messages,
        analyticsTraces,
        pitchHistory,
        sensorMetrics?.volume ?? 0,
    );

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

    const handleTryAgain = () => {
        clearAnalysis();
        flush();
    };

    // ── Post-Match Report: Full-screen takeover when analysis is complete ──
    if (analysisResult && !isStreaming) {
        return (
            <>
                <PostMatchReport
                    result={analysisResult}
                    scenarioId={scenarioId}
                    sessionDurationMs={sessionDurationMs}
                    onTryAgain={handleTryAgain}
                />
                {/* Debug Dashboard still available */}
                <AnalyticsDebugPanel traces={analyticsTraces} />
            </>
        );
    }

    // ── Active Simulation View ──
    return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4 sm:p-6">
            <Card title="Simulation" className="w-full max-w-screen-2xl flex flex-col p-4 shadow-2xl">
                
                {/* Main Stage (21:9 Cinematic Image + HUD Overlay) */}
                <div className="relative w-full aspect-video md:aspect-21/9 rounded-xl overflow-hidden border border-neutral-700/50 bg-black shadow-inner">
                    {/* The visual persona and transcript panel */}
                    <EviConvoPanel messages={messages} imageUrl={activeConfig.image} />
                    
                    {/* HUD: Telemetry (Top Right Overlay) */}
                    <div className="absolute top-4 right-4 w-64 z-20 pointer-events-none flex flex-col gap-3">
                        <SensorMetricsPanel metrics={sensorMetrics} pitchHistory={pitchHistory} />
                        
                        {preliminaryTags.length > 0 && (
                            <div className="flex flex-col gap-1.5 items-end">
                                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-1 mb-0.5">Vocal Characteristics</div>
                                {preliminaryTags.map((tag, i) => (
                                    <div key={i} className="bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-900/20 animate-in slide-in-from-right-4 fade-in duration-300">
                                        {tag}
                                    </div>
                                ))}
                            </div>
                        )}
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
