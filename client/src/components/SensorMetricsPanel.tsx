import { type SensorMetrics } from '../hooks/useSensorMetrics';
import { MetricGraph } from './metricGrpah';
import { MetricMeter } from './metricMeter';

interface SensorMetricsPanelProps {
    metrics: SensorMetrics | null;
    pitchHistory: number[];
    wpm?: number;
}

/**
 * A presentation component that visually bundles all live sensor data.
 * 
 * Takes the raw metrics passed down from the session hook and distributes
 * them to the appropriate visualizations (Meters, Graphs, and Text).
 */
export default function SensorMetricsPanel({ metrics, pitchHistory, wpm }: SensorMetricsPanelProps) {
    if (!metrics) return null;

    // Simple visual cue: Green for high dynamic range (good), yellow/red for monotone.
    const color = metrics.pitch_variance > 80 ? '#22c55e' : metrics.pitch_variance > 40 ? '#eab308' : '#ef4444';
    
    return (
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 text-white shadow-xl flex flex-col gap-3 w-full backdrop-saturate-150">
            <MetricMeter value={metrics.volume} min={0} max={1} />
            <MetricGraph data={pitchHistory} label="Pitch" unit="Hz" min={80} max={400} color={color}/>
            <div className="bg-black/40 p-3 rounded-lg border border-white/5 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Status</span>
                    <span className={`text-sm font-bold tracking-wide ${metrics.is_speaking ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-neutral-500'}`}>
                        {metrics.is_speaking ? 'Speaking...' : 'Listening...'}
                    </span>
                </div>
                
                <div className="flex justify-between items-center border-t border-white/10 pt-2">
                    <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">Pace (WPM)</span>
                    <span className="text-sm font-bold tracking-wide text-white">{wpm !== undefined ? wpm : 0}</span>
                </div>
            </div>
        </div>
    )
}