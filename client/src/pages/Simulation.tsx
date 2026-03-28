import { VoiceProvider } from '@humeai/voice-react';
import { useEffect, useRef, useState } from 'react';
import Card from '../components/common/Card';
import EviConvoPanel from '../components/eviConvoPanel';
import SensorMetricsPanel from '../components/SensorMetricsPanel';
import SimControlPanel from '../components/SimControlPanel';
import { useEviManager } from '../hooks/useEviManager';
import { useSimulationSession } from '../hooks/useSimulationSession';

const SimulationInner = () => {
    // 1. Rust Audio/Physics Session
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, startSession, endSession } = useSimulationSession();
    
    // 2. Hume EVI Session
    const { startEviSession, stopEviSession, messages, activeConfig, status } = useEviManager();
    const isStreaming = sessionStatus === 'active' || status.value === 'connected';
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

        // Diagnostic log: ensure the effect is firing and we see the Hume status
        console.log(`[WPM Status] evi: ${status.value}, words_history: ${messages.length}`);

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
                
                console.log(`[WPM Speedometer] +${deltaWords} words in ${deltaTimeMs}ms -> Pace: ${Math.round(instantWpm)}`);
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
 */
const Simulation = () => {
    return (
        <VoiceProvider>
            <SimulationInner />
        </VoiceProvider>
    )
}

export default Simulation;