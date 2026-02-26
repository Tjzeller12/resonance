import { useCallback, useRef, useState } from "react";

// Matches the JSON structure returned by the Rust backend's AudioMetrics message
export interface SensorMetrics {
    volume: number,
    pitch: number,
    pitch_variance: number,
    is_speaking: boolean,

}

interface AudioMetricsMessage {
    type: 'AudioMetrics';
    data: SensorMetrics;
}

interface UnknownMessage {
    type: string;
}

type ServerMessage = AudioMetricsMessage | UnknownMessage;

export const useSensorMetrics = () => {
    const MAX_HISTORY: number = 60;
    // --- State ---
    const [sensorMetrics, setSensorMetrics] = useState<SensorMetrics | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [pitchHistory, setPitchHistory] = useState<number[]>([]);

    // --- Refs (mutable values that survive re-renders but don't trigger them) ---
    const ws: React.RefObject<WebSocket | null> = useRef<WebSocket | null>(null);              // WebSocket connection to the Rust server
    const audioContext: React.RefObject<AudioContext | null> = useRef<AudioContext | null>(null); // Web Audio API context
    const mediaStream: React.RefObject<MediaStream | null>= useRef<MediaStream | null>(null);  // Raw microphone stream from getUserMedia
    const workletNode = useRef<AudioWorkletNode | null>(null);                                  // AudioWorklet node for PCM capture (runs on audio thread)
    const WS_URL = 'ws://localhost:3000/ws';

    const smoothedPitch = useRef<number>(0);
    const EMA_ALPHA = 0.8;

    // Requests microphone access, builds the audio processing pipeline,
    // and begins streaming Int16 PCM data to the Rust server via WebSocket
    const startStreaming = async () => {

        try {
            // Create audio context at 16kHz to match the Rust sensor's expected sample rate
            audioContext.current = new window.AudioContext({ sampleRate: 16000 });

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {channelCount: 1, sampleRate: 16000 }
            });

            mediaStream.current = stream;

            // Wrap the microphone stream as a Web Audio source node
            const source = audioContext.current.createMediaStreamSource(stream);


            // Load the AudioWorklet processor from /public — it runs on a dedicated audio thread
            await audioContext.current.audioWorklet.addModule('/audio-processor.js');

            workletNode.current = new AudioWorkletNode(audioContext.current, 'audio-processor');

            // Audio graph: microphone source → worklet (captures PCM) → destination (silent output)
            source.connect(workletNode.current);
            workletNode.current.connect(audioContext.current.destination);

            workletNode.current.port.onmessage = (event: MessageEvent<Float32Array>) => {
                if (ws.current?.readyState === WebSocket.OPEN) {
                    const float32Data: Float32Array = event.data;
                    console.log("Sending audio", float32Data);
                    // Convert Float32 [-1.0, 1.0] → Int16 [-32768, 32767]
                    // Int16 PCM is the standard format the Rust sensor expects
                    const int16Data = new Int16Array(float32Data.length);
                    for(let i = 0; i < float32Data.length; i++) {
                        const s = Math.max(-1, Math.min(1, float32Data[i])); // clamp to valid range
                        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;     // scale to Int16 range
                    }

                    ws.current.send(int16Data.buffer);
                }
            }
            setIsStreaming(true);
        } catch (err) {
            console.error(err);
            console.log("Audio Streaming Error");
        }
    }

    // Tears down the audio pipeline cleanly and releases the microphone
    const stopStreaming = async () => {
        try {
            if (isStreaming) {
                if (workletNode.current) {
                    workletNode.current.disconnect();
                    workletNode.current = null;
                }

                if (audioContext.current) {
                    await audioContext.current.close();
                    audioContext.current = null;
                }

                if (mediaStream.current) {
                    // Stopping tracks releases the microphone and turns off the browser's mic indicator
                    mediaStream.current.getTracks().forEach(track => track.stop());
                    mediaStream.current = null;
                }

                setIsStreaming(false);
            }

        } catch (err) {
            console.error(err);
            console.log('Audio Streaming Error When Attempting to Stop Streaming')
        }
        if (!isConnected) return;
        

    }

        // Parses incoming JSON messages from the Rust server and updates state accordingly
    const handleMessage = useCallback((data: unknown) => {
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data) as ServerMessage;
                console.log('Recieved Message: ', msg);
                if (msg.type === 'AudioMetrics') {
                    const metrics = (msg as AudioMetricsMessage).data;
                    console.log('Recieved AudioMetrics: ', metrics);
                    setSensorMetrics(metrics);
                    if (metrics.pitch > 80) {
                        smoothedPitch.current = (EMA_ALPHA * metrics.pitch) + ((1 - EMA_ALPHA) * smoothedPitch.current);
                        setPitchHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), smoothedPitch.current]);
                    }
                } else {
                    console.log("Unkown Message Type ", msg.type);
                }
            } catch (err) {
                console.error("JSON Parse Error", err);
            }
        }
        
    }, []);

    // Opens the WebSocket connection to the Rust backend.
    // Intentionally exposed so the consuming component controls when to connect
    // (allows this hook to be used in non-display contexts too)
    const connect = useCallback((): void => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        try {
            console.log('Connecting to', WS_URL);
            ws.current = new WebSocket(WS_URL);
            ws.current.binaryType = 'arraybuffer';

            ws.current.onopen = () => {
                console.log('WebSocket Connected');
                setIsConnected(true);
            };

            ws.current.onclose = (e) => {
                console.log('WebSocket Closed', e.code, e.reason);
                setIsConnected(false);
                setIsStreaming(false);
                // Reset live metrics to zero on disconnect (preserve pitch_variance for display)
                setSensorMetrics(prev => ({
                    volume: 0,
                    pitch: 0,
                    pitch_variance: prev?.pitch_variance ?? 0,
                    is_speaking: false
                }));
            };

            ws.current.onerror = (e) => {
                console.log('WebSocket Error', e);
            };

            ws.current.onmessage = (e) => {
                handleMessage(e.data);
            };
        } catch (err) {
            console.error(err);
        }
    }, [handleMessage]);

    // Closes the WebSocket connection cleanly.
    // Nulls out event handlers first to suppress spurious onclose/onerror callbacks
    const disconnect = useCallback(() => {
        if (ws.current) {
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.onmessage = null;
            ws.current.close();
            ws.current = null;
        }
        setIsConnected(false);
        setIsStreaming(false);
        return true;

    }, []);

    return {
        isConnected,
        isStreaming,
        sensorMetrics,
        pitchHistory,
        startStreaming,
        stopStreaming,
        connect,
        disconnect
    }
    
}
