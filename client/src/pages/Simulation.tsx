import { VoiceProvider } from '@humeai/voice-react';
import type { Hume } from 'hume';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/common/Card';
import EviConvoPanel from '../components/eviConvoPanel';
import SensorMetricsPanel from '../components/SensorMetricsPanel';
import SimControlPanel from '../components/SimControlPanel';
import { useEviManager } from '../hooks/useEviManager';
import { useSimulationSession } from '../hooks/useSimulationSession';
import { useStageDirector } from '../hooks/useStageDirector';

const SimulationInner = ({ advanceStageRef }: { advanceStageRef: React.MutableRefObject<(() => void) | null> }) => {
    // 1. Rust Audio/Physics Session
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, startSession, endSession } = useSimulationSession();
    
    // 2. Hume EVI Session
    const { startEviSession, stopEviSession, messages, activeConfig, status, sendSessionSettings } = useEviManager();
    const isStreaming = sessionStatus === 'active' || status.value === 'connected';

    // 3. Stage Director (for staged simulations like interviews)
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || '';
    const director = useStageDirector(scenarioId, sendSessionSettings as (settings: Record<string, unknown>) => void);

    // Bind the director's advance function to the parent's ref so the VoiceProvider's onToolCall can trigger it
    useEffect(() => {
        if (advanceStageRef) {
            advanceStageRef.current = director.advanceStage;
        }
    }, [director.advanceStage, advanceStageRef]);

    // 3. Responsive WPM Velocity (Exponential Moving Average)
    const [wpm, setWpm] = useState<number>(0);
    const lastWordCount = useRef<number>(0);
    const lastWordTimestamp = useRef<number>(0);

    // Derived WPM for display (resets to 0 in UI when not streaming)
    // This avoids the cascading render lint by not calling setState purely for resets.
    const displayWpm = isStreaming ? wpm : 0;

    // Calculate a truly responsive WPM based on the delta between Hume transcript updates.
    // Uses an EMA (Exponential Moving Average) to smooth out "bursty" network packets.
    useEffect(() => {
        if (!isStreaming) {
            lastWordCount.current = 0;
            lastWordTimestamp.current = 0;
            return;
        }

        const currentTotalWords = messages.reduce((acc, msg) => {
            if (msg.type === 'user_message') {
                let text = '';
                if ('message' in msg && msg.message?.content) text = msg.message.content;
                else {
                    const m = msg as unknown as Record<string, unknown>;
                    if (typeof m.transcript === 'string') text = m.transcript;
                    else if (typeof m.text === 'string') text = m.text;
                }
                return acc + (text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0);
            }
            return acc;
        }, 0);

        const now = Date.now();
        const deltaWords = currentTotalWords - lastWordCount.current;
        const deltaTimeMs = now - lastWordTimestamp.current;

        // If new words arrived and it's been at least 400ms since the last update
        if (deltaWords > 0 && lastWordTimestamp.current > 0) {
            if (deltaTimeMs > 400) { 
                const instantWpm = (deltaWords / (deltaTimeMs / 60000));
                const cappedInstant = Math.min(instantWpm, 350); // Cap outliers
                
                setWpm(prev => {
                    const alpha = 0.4; // 40% weight to new data for high responsiveness
                    const smooth = (cappedInstant * alpha) + (prev * (1 - alpha));
                    return Math.round(smooth);
                });
                
                lastWordCount.current = currentTotalWords;
                lastWordTimestamp.current = now;
            }
        } else if (lastWordTimestamp.current === 0 && deltaWords > 0) {
            lastWordCount.current = currentTotalWords;
            lastWordTimestamp.current = now;
            setWpm(0); // Reset EMA base for the new session
        } else if (currentTotalWords < lastWordCount.current) {
            lastWordCount.current = currentTotalWords;
        }
    }, [messages, isStreaming, status.value]);

    const handleStart = () => {
        void startSession();
        void startEviSession();
    };

    const handleEnd = () => {
        void endSession();
        stopEviSession();
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4 sm:p-6">
            <Card title="Simulation" className="w-full max-w-screen-2xl flex flex-col p-4 shadow-2xl">
                
                {/* Main Stage (21:9 Cinematic Image + HUD Overlay) */}
                <div className="relative w-full aspect-video md:aspect-21/9 rounded-xl overflow-hidden border border-neutral-700/50 bg-black shadow-inner">
                    <EviConvoPanel messages={messages} imageUrl={activeConfig.image} />
                    
                    {/* HUD: Telemetry (Top Right Overlay) */}
                    <div className="absolute top-4 right-4 w-64 z-20 pointer-events-none">
                        <SensorMetricsPanel metrics={sensorMetrics} pitchHistory={pitchHistory} wpm={displayWpm} />
                    </div>

                    {/* Stage Indicator (Left Side, below Telemetry height-wise) — only for staged simulations */}
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
                </div>

                {/* Bottom: Start/Stop controls */}
                <div className="w-full mt-6 pt-6 border-t border-neutral-800">
                    <SimControlPanel
                        isConnected={isConnected}
                        isStreaming={isStreaming}
                        onStart={() => { handleStart(); }}
                        onEnd={() => { handleEnd(); }}
                    />
                </div>

            </Card>
        </div>
    )
}

/**
 * The main Simulation view where coaching sessions actually occur.
 * Wraps the internal logic with Hume's VoiceProvider.
 * Passes onToolCall to handle stage advancement for staged simulations.
 */
const Simulation = () => {
    // We need to check if this is a staged simulation to set up the tool call handler.
    // The handler is set up at the VoiceProvider level, but the actual stage advancement
    // happens in the useStageDirector hook inside SimulationInner.
    // We use a ref to hold the advanceStage callback that gets set by SimulationInner.
    const advanceStageRef = useRef<(() => void) | null>(null);
    const [lastToolCall, setLastToolCall] = useState<{ name: string; timestamp: number } | null>(null);

    const handleToolCall = useCallback(async (
        message: { name: string; toolCallId: string; parameters: string; toolType: typeof Hume.empathicVoice.ToolType.Function },
        send: {
            success: (content: unknown) => Hume.empathicVoice.ToolResponseMessage;
            error: (e: { error: string; code: string; level: string; content: string }) => Hume.empathicVoice.ToolErrorMessage;
        },
    ) => {
        await Promise.resolve(); // Satisfy lint: async function must have await
        console.log(`%c[ToolCall] 🛠️ AI invoked: ${message.name}`, 'color: #10b981; font-weight: bold; font-size: 12px;');
        console.log('[ToolCall] Params:', message.parameters);

        setLastToolCall({ name: message.name, timestamp: Date.now() });

        // Auto-clear tool call indicator after 3 seconds
        setTimeout(() => {
            setLastToolCall(prev => {
                if (prev && Date.now() - prev.timestamp >= 3000) return null;
                return prev;
            });
        }, 3000);

        if (message.name === 'advance_stage') {
            // Fire the stage advancement
            advanceStageRef.current?.();
            console.log('%c[ToolCall] ✅ Stage advanced', 'color: #059669; font-weight: bold;');
            return send.success('Stage advanced successfully.');
        }

        // Unknown tool
        console.warn(`[ToolCall] ❌ Unknown tool: ${message.name}`);
        return send.error({
            error: 'Unknown tool',
            code: 'unknown_tool',
            level: 'error',
            content: `Tool "${message.name}" is not recognized.`,
        });
    }, []);

    return (
        <VoiceProvider onToolCall={handleToolCall}>
            <SimulationInner advanceStageRef={advanceStageRef} />

            {/* Tool Call Notification Overlay */}
            {lastToolCall && (
                <div className="fixed bottom-24 right-8 z-50 animate-in slide-in-from-right-10 duration-500">
                    <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Tool Call Triggered</div>
                            <div className="text-sm font-semibold text-white mt-0.5">{lastToolCall.name}()</div>
                        </div>
                    </div>
                </div>
            )}
        </VoiceProvider>
    )
}

export default Simulation;