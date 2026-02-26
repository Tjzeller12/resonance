import { useEffect, useState } from 'react';
import { useSensorMetrics } from './useSensorMetrics';

/**
 * Manages the high-level lifecycle of a coaching simulation session.
 * 
 * This hook acts as an orchestrator, sitting above the lower-level `useSensorMetrics` hook.
 * It tracks the overall session state (idle, active, ended) and automatically handles
 * reconnection logic in case the WebSocket drops mid-session.
 */
export const useSimulationSession = () => {
    // Tracks a unique identifier for the current session (useful for future database logging)
    const [sessionId, setSessionId] = useState<string | null>(null);
    
    // Tracks the lifecycle phase of the coaching session
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'ended'>('idle');

    // Rely on the lower-level sensory hook to handle the actual WebSocket and Audio pipeline setup
    const { sensorMetrics, pitchHistory, isConnected,
        startStreaming, stopStreaming, connect, disconnect }
        = useSensorMetrics();
    
    /**
     * Bootstraps the session by generating an ID and immediately asking the sensor layer
     * to request microphone permissions and begin streaming audio data.
     */
    const startSession = async () => {
        setSessionId('test-id-123'); // Placeholder - would normally come from an API
        await startStreaming();
        setSessionStatus('active');
    }

    const endSession = async () => {
        await stopStreaming();
        setSessionStatus('ended');
    }

    useEffect(() => {
        if (sessionStatus === 'active' && !isConnected) {
            console.log('Connection lost during session, attempting reconnect...');
            const timer = setTimeout(() => {
                connect();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isConnected, sessionStatus, connect])

    useEffect(() => {
        connect();
        return () => { disconnect(); };
    }, [connect, disconnect])

    return {
        sessionId, sessionStatus, isConnected, sensorMetrics, pitchHistory, startSession, endSession
    }
        
}
