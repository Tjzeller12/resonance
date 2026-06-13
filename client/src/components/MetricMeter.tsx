interface MeterProps {
    value: number;
    min: number;
    max: number;
}

/**
 * A horizontal volume/intensity meter that fills a progress bar left-to-right.
 * Used for live visual feedback of instantaneous sensor values like audio volume.
 */
export const MetricMeter = ({value, min, max}: MeterProps) => {
    // Normalizes the raw value to a 0-100 percentage.
    // Math.clamp equivalent is used to guarantee the bar never overfills or underfills bounds.
    const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

    const color = percent > 80 ? '#eab308'
                : percent > 40 ? '#22c55e'
                : '#3b82f6';   
    return (
    <div className="w-full">
        <div className="flex justify-between items-center mb-1">
            <span className="text-neutral-400 text-xs">Volume</span>
            <span className="text-xs text-neutral-500">{value.toFixed(2)}</span>
        </div>
        {/* Horizontal track — wide and short */}
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-75"
                style={{ width: `${percent}%`, backgroundColor: color }}
            />
        </div>
    </div>
    )
}