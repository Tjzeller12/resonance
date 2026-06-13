import { useEffect, useState } from 'react';
import { useSensorMetrics } from './useSensorMetrics';

/**
 * useSimulationSession is the high-level manager for a "Simulation Session".
 * 
 * DESIGN RATIONALE:
 * While `useSensorMetrics` handles the "plumbing" of audio and WebSockets, 
 * this hook manages the "business logic" of the session. It tracks 
 * whether a session is officially active and provides a central point 
 * for the UI to trigger the start/stop of all sensory inputs.
 * 
 * @returns {Object} { sessionId, sessionStatus, isConnected, sensorMetrics, pitchHistory, startSession, endSession }
 */
export const useSimulationSession = () => {
    // A unique identifier for the current coaching encounter.
    const [sessionId, setSessionId] = useState<string | null>(null);
    
    // Lifecycle state: idle -> active -> ended
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'ended'>('idle');

    // Pull in the underlying sensory layer
    const { 
        sensorMetrics, 
        pitchHistory, 
        isConnected,
        liveTags,
        startStreaming, 
        stopStreaming, 
        connect, 
        disconnect
    } = useSensorMetrics();
    
    /**
     * startSession kicks off the entire Resonance sensory engine.
     * It requests hardware (mic) access and starts the data transmission to Rust.
     */
    const startSession = async () => {
        setSessionId('test-id-123'); // In production, this might be a UUID from the server
        await startStreaming();
        setSessionStatus('active');
    }

    /**
     * endSession cleanly shuts down the sensory engine.
     */
    const endSession = async () => {
        await stopStreaming();
        setSessionStatus('ended');
    }

    /**
     * RECONNECTION WATCHDOG:
     * If the WebSocket drops while we are in an 'active' session, this 
     * effect will attempt to re-establish the connection automatically.
     */
    useEffect(() => {
        if (sessionStatus === 'active' && !isConnected) {
            console.log('[Session] Connection lost, attempting reconnect...');
            const timer = setTimeout(() => {
                connect();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isConnected, sessionStatus, connect])

    /**
     * AUTO-CONNECT:
     * Ensures the control-plane WebSocket is ready as soon as the hook mounts.
     */
    useEffect(() => {
        connect();
        return () => { disconnect(); };
    }, [connect, disconnect])

    return {
        sessionId, 
        sessionStatus, 
        isConnected, 
        sensorMetrics, 
        pitchHistory,
        liveTags,
        startSession, 
        endSession
    }
}
