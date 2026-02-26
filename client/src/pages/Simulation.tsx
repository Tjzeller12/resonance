import Card from '../components/common/Card';
import SensorMetricsPanel from '../components/SensorMetricsPanel';
import SimControlPanel from '../components/SimControlPanel';
import { useSimulationSession } from '../hooks/useSimulationSession';



const Simulation = () => {
    const { sensorMetrics, sessionStatus, isConnected, pitchHistory, startSession, endSession } = useSimulationSession();

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