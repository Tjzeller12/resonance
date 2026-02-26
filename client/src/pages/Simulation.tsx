import Card from '../components/common/Card';
import SensorMetricsPanel from '../components/SensorMetricsPanel';
import SimControlPanel from '../components/SimControlPanel';
import { useSimulationSession } from '../hooks/useSimulationSession';



/**
 * The main Simulation view where coaching sessions actually occur.
 * 
 * This page brings together all the complex underlying state — WebSockets,
 * AudioWorklets, and Rust API events — and passes them down to simple,
 * dumb presentation components (SensorMetricsPanel, SimControlPanel).
 */
const Simulation = () => {
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, startSession, endSession } = useSimulationSession();

    // The stream is considered completely active only while the session dictates it
    const isStreaming = sessionStatus === 'active';

    return (
        <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-6">
            <Card title="Simulation" className="max-w-md w-full">
                <SensorMetricsPanel metrics={sensorMetrics} pitchHistory={pitchHistory} />
                <SimControlPanel
                    isConnected={isConnected}
                    isStreaming={isStreaming}
                    onStart={() => { void startSession(); }}
                    onEnd={() => {void endSession(); }}
                />
            </Card>
        </div>
    )
}

export default Simulation;