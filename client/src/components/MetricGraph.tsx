interface MetricGraphProps {
    data: number[];
    label: string;
    unit?: string;
    color?: string;
    min?: number;
    max?: number;
    referenceLine?: number;
}

/**
 * Renders a real-time tracking line graph using pure SVG polylines.
 * This is highly optimized for performance, skipping heavy charting libraries like Recharts
 * by manually projecting simple 1D arrays into 2D SVG space.
 */
export const MetricGraph = ({data, label, unit = '', color = '#3b82f6', min = 0, max = 400,
    referenceLine
}: MetricGraphProps) => { 
    // Fixed internal coordinate system bounds — the actual viewing size will scale 
    // responsively via the svg `viewBox` property.
    const WIDTH = 300;
    const HEIGHT = 80;

    // Converts raw data values (e.g. pitch in Hz) into X/Y coordinates on the SVG plane.
    // X advances uniformly left-to-right. Y is inverted (SVG 0 is top) and scaled between min/max.
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * WIDTH;
        const y = HEIGHT - ((val - min) / (max - min)) * HEIGHT;
        return `${x},${Math.max(0, Math.min(HEIGHT, y))}`;
    }).join(' ');

    const currentVal = data[data.length - 1] ?? 0;

    return (
            <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-700/50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-neutral-400 text-xs">{label}</span>
                    <span className="text-sm font-semibold">{currentVal.toFixed(unit === 'Hz' ? 0 : 2)} {unit}</span>
                </div>
                <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="overflow-visible">
                    {/* Optional reference line (future median pitch) */}
                    {referenceLine !== undefined && (
                        <line
                            x1={0} y1={HEIGHT - ((referenceLine - min) / (max - min)) * HEIGHT}
                            x2={WIDTH} y2={HEIGHT - ((referenceLine - min) / (max - min)) * HEIGHT}
                            stroke="#6b7280" strokeWidth="1" strokeDasharray="4 4"
                        />
                    )}
                    {/* The graph line */}
                    {data.length > 1 && (
                        <polyline
                            points={points}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                </svg>
            
        </div>
    );
}