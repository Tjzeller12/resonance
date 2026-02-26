import { type SensorMetrics } from '../hooks/useSensorMetrics';
import Card from './common/Card';
import { MetricGraph } from './metricGrpah';
import { MetricMeter } from './metricMeter';

interface SensorMetricsPanelProps {
    metrics: SensorMetrics | null;
    pitchHistory: number[];
}

export default function SensorMetricsPanel({ metrics, pitchHistory }: SensorMetricsPanelProps) {
    if (!metrics) return null;

    const color = metrics.pitch_variance > 80 ? '#22c55e' : metrics.pitch_variance > 40 ? '#eab308' : '#ef4444';
    
    return (
        <Card variant='glass'>
            <div className="flex flex-col gap-3 mt-6 w-full">
                <MetricMeter value={metrics.volume} min={0} max={1} />
                <MetricGraph data={pitchHistory} label="Pitch" unit="Hz" min={80} max={400} color={color}/>
                <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-700/50 col-span-2">
                    <div className="text-neutral-400 text-xs mb-1">Status</div>
                    <div className={`text-xl font-bold ${metrics.is_speaking ? 'text-green-400' : 'text-neutral-500'}`}>
                        {metrics.is_speaking ? 'Speaking...' : 'Listening...'}
                    </div>
                </div>
            </div>
        </Card>
    )
}