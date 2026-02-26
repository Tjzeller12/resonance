interface SimControlsProps {
    isConnected: boolean;
    isStreaming: boolean;
    onStart: () => void;
    onEnd: () => void;
}

/**
 * The primary user interaction point for the simulation.
 * 
 * Handles the Start/Stop toggle button and visually indicates whether
 * the WebSocket connection to the Rust backend is currently healthy.
 */
export default function SimControlPanel({ isConnected, isStreaming, onStart, onEnd}: SimControlsProps) {
    return(
        <div className="flex flex-col items-center gap-4">
            {/* Connection indicator */}
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-neutral-400">
                    {isConnected ? 'Server Connected' : 'Disconnected'}
                </span>
            </div>
            {/* Start / End button */}
            <button
                onClick={isStreaming ? onEnd : onStart}
                disabled={!isConnected}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    isStreaming
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                }`}
            >
                {isStreaming ? 'End Simulation' : 'Start Simulation'}
            </button>
        </div>
    )
}