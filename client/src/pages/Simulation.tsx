import { VoiceProvider } from '@humeai/voice-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
    const { startEviSession, stopEviSession, messages, activeConfig, status, pauseAssistant, resumeAssistant } = useEviManager();

    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || 'dojo';

    const isStreaming = sessionStatus === 'active' || status.value === 'connected';

    // 3. Custom "Power Pause" VAD Orchestrator
    const pauseTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        // Only enforce the 3-second power pause constraint for the Dojo scenario
        if (scenarioId !== 'dojo' || status.value !== 'connected') return;

        if (sensorMetrics?.is_speaking) {
            // User is actively speaking: lock down the assistant to prevent early interruptions
            if (pauseTimeoutRef.current) {
                window.clearTimeout(pauseTimeoutRef.current);
                pauseTimeoutRef.current = null;
            }
            pauseAssistant();
        } else {
            // User stopped speaking: set a rigid 3000ms delay before releasing the assistant's speech
            pauseTimeoutRef.current = window.setTimeout(() => {
                resumeAssistant();
            }, 3000);
        }

        return () => {
            if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current);
        }
    }, [sensorMetrics?.is_speaking, scenarioId, status.value, pauseAssistant, resumeAssistant]);

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
                        <SensorMetricsPanel metrics={sensorMetrics} pitchHistory={pitchHistory} />
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