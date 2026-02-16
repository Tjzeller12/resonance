import {
    initialize,
    requestMicrophonePermissionsAsync,
    toggleRecording,
    useExpoTwoWayAudioEventListener
} from '@speechmatics/expo-two-way-audio';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { SensorMetrics } from '../app/types';
// Backend URL - Change to your computer's IP for Android/Real Device
// Backend URL - 10.0.2.2 is the special "Localhost" alias for Android Emulator
const WS_URL = 'ws://localhost:3000/ws';

export default function LiveWire() {
    const [isConnected, setIsConnected] = useState(false);
    const [isMicrophonePermissionGranted, setIsMicrophonePermissionGranted] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sensorMetrics, setSensorMetrics] = useState<SensorMetrics | null>(null);

    const ws = useRef<WebSocket | null>(null);

    useFocusEffect(
        useCallback(() => {
            initialize().then((success) => {
                console.log('Initialization successful:', success);
                connect();
            });

            return () => {
                console.log('Leaving screen, disconnecting...');
                stopStreaming();
                disconnect();
            };
        }, [])
    );

    const connect = (): void => {
        if (ws.current?.readyState === WebSocket.OPEN) return;

        try {
            console.log('Connecting to', WS_URL);
            ws.current = new WebSocket(WS_URL);
            ws.current.binaryType = 'arraybuffer';

            ws.current.onopen = () => {
                console.log('WebSocket Connected');
                setIsConnected(true);
                setError(null);
            };

            ws.current.onclose = (e) => {
                console.log('WebSocket Closed', e.code, e.reason);
                setIsConnected(false);
                setIsStreaming(false);
            };

            ws.current.onerror = (e) => {
                console.log('WebSocket Error', e);
                setError('WebSocket Connection Failed');
            };

            ws.current.onmessage = (e) => {
                handleMessage(e.data);
            };
        } catch (err) {
            console.error(err);
            setError('Connection Error');
        }
    };

    const getMicrophonePermissions = async () => {
        const permission = await requestMicrophonePermissionsAsync();
        setIsMicrophonePermissionGranted(permission.granted);
        if (!permission.granted){
            setError('Microphone permission denied');
            return false;
        }
        return true;
    }

    const disconnect = () => {
        if (ws.current) {
            // Remove listeners so we don't trigger "Error" or "Closed" alerts during manual disconnect
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.onmessage = null;
            ws.current.close();
            ws.current = null;
        }
        setIsConnected(false);
        setIsStreaming(false);
        return true;
    };

    const startStreaming = async () => {
        if (!isConnected) return;
        if (!isMicrophonePermissionGranted) {
            const granted = await getMicrophonePermissions();
            if (!granted) return;
        }

        try {
            console.log("Starting Audio Streaming");
            const success = await toggleRecording(true);
            if (!success) {
                setError('Failed to start audio streaming');
                return;
            }
            setIsStreaming(true);
        } catch (err) {
            console.error(err);
            setError('Audio Streaming Error');
        }
    };

    const stopStreaming = async () => {
        try {
            if (!isConnected) return;
            if (isStreaming) {
                const isRecording = await toggleRecording(false);
                if(isRecording) {
                    setError('Failed to stop audio streaming');
                    return;
                }
                setIsStreaming(false);
            }
        } catch (err) {
            console.error(err);
            setError('Audio Streaming Error');
        }
    }

    const transmitAudioChunk = (pcmData: string | number | true | Uint8Array<ArrayBufferLike>) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            const payload = new Uint8Array(pcmData as any);
            // Trace the outbound packet
            console.log(`Sending ${payload.length} bytes. Sample: [${payload[0]}, ${payload[1]}]`);
            ws.current.send(payload);
        } else {
            console.log("Socket not open, dropping audio");
        }
    };

    const handleMessage = (data: any) => {
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                console.log('Recieved Message: ', msg);
                if (msg.type === 'AudioMetrics') {
                    console.log('Recieved AudioMetrics: ', msg.data);
                    setSensorMetrics(msg.data);
                } else {
                    console.log('Unknown Message Type: ', msg.type);
                }
            } catch (err) {
                console.error("JSON Parse Error", err);
            }
        }
    };

    useExpoTwoWayAudioEventListener('onMicrophoneData', (event) => {
        if (event.data) {
            transmitAudioChunk(event.data);
        }
    })

    return (
        <View style={styles.container}>
            <Text style={styles.status}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.controls}>

                <View style={{height: 20}} />

                <Button title={isStreaming ? "Stop Streaming" : "Start Streaming"} onPress={isStreaming ? stopStreaming : startStreaming} disabled={!isConnected} />

            </View>

            {sensorMetrics && (
                <View style={{marginTop: 20}}>
                    <Text>Volume: {sensorMetrics.volume.toFixed(2)}</Text>
                    <Text>Pitch: {sensorMetrics.pitch.toFixed(0)} Hz</Text>
                    <Text>Pitch Variance: {sensorMetrics.pitch_variance?.toFixed(2) || "0.00"}</Text>
                    <Text>Is Speaking: {sensorMetrics.is_speaking ? 'Yes' : 'No'}</Text>
                </View>
            )}
        </View>
    );

 }

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    status: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    controls: {
        width: '100%',
    },
    error: {
        color: 'red',
        marginTop: 10,
    }
})