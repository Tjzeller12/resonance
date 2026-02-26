import { useEffect, useState } from 'react';
import { useSensorMetrics } from './useSensorMetrics';

export const useSimulationSession = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'active' | 'ended'>('idle');

    const { sensorMetrics, pitchHistory, isConnected,
        startStreaming, stopStreaming, connect, disconnect }
        = useSensorMetrics();
    
    const startSession = async () => {
        setSessionId('test-id-123');
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
