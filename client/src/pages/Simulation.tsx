import { VoiceProvider } from '@humeai/voice-react';
import type { Hume } from 'hume';
import { useCallback, useRef, useState } from 'react';
import SimulationInner from '../components/SimulationInner';

/**
 * The main Simulation entry point.
 * 
 * DESIGN RATIONALE:
 * We split this into two parts: `Simulation` (the parent/wrapper) and `SimulationInner` (the logic).
 * 
 * 1. The `VoiceProvider` (Hume SDK) must wrap everything to provide the socket context.
 * 2. `Simulation` handles "Universal" events like AI Tool Calls.
 * 3. `SimulationInner` handles the specific UI, sensor metrics, and session state.
 * 
 * This separation prevents the main view from becoming a "Mega-File" and makes it 
 * easier to debug the AI's tool-calling behavior independently of the UI.
 */
const Simulation = () => {
    /**
     * advanceStageRef: The Bridge
     * 
     * Because the logic to "advance the interview stage" lives inside a hook in the 
     * Child component, but the Tool Call listener lives here in the Parent, 
     * we use this Ref as a bridge. 
     * 
     * The Child (SimulationInner) will plug its function into this ref on mount.
     */
    const advanceStageRef = useRef<(() => void) | null>(null);
    
    // Local state to show a "Toast" or notification when the AI triggers a tool
    const [lastToolCall, setLastToolCall] = useState<{ name: string; timestamp: number } | null>(null);

    /**
     * handleToolCall: The AI's "Remote Control"
     * 
     * This function fires whenever the AI decides it needs to perform an action 
     * (like advancing to the next stage of an interview).
     */
    const handleToolCall = useCallback(async (
        message: { name: string; toolCallId: string; parameters: string; toolType: typeof Hume.empathicVoice.ToolType.Function },
        send: {
            success: (content: unknown) => Hume.empathicVoice.ToolResponseMessage;
            error: (e: { error: string; code: string; level: string; content: string }) => Hume.empathicVoice.ToolErrorMessage;
        },
    ) => {
        await Promise.resolve(); // Async boilerplate
        
        console.log(`%c[ToolCall] 🛠️ AI invoked: ${message.name}`, 'color: #10b981; font-weight: bold; font-size: 12px;');
        console.log('[ToolCall] Params:', message.parameters);

        setLastToolCall({ name: message.name, timestamp: Date.now() });

        // UI: Auto-clear tool call indicator after 3 seconds
        setTimeout(() => {
            setLastToolCall(prev => {
                if (prev && Date.now() - prev.timestamp >= 3000) return null;
                return prev;
            });
        }, 3000);

        /**
         * Logic: Advance Stage
         * If the AI calls 'advance_stage', we call the function stored in our Bridge Ref.
         */
        if (message.name === 'advance_stage') {
            advanceStageRef.current?.();
            console.log('%c[ToolCall] ✅ Stage advanced', 'color: #059669; font-weight: bold;');
            return send.success('Stage advanced successfully.');
        }

        // Unknown tool handling
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
            {/* SimulationInner handles the UI, Rust sensors, and EVI start/stop */}
            <SimulationInner advanceStageRef={advanceStageRef} />

            {/* Tool Call Notification Overlay: Let's the user know the AI just "did" something */}
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
    );
};

export default Simulation;