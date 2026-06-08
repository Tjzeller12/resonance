interface ScoreBarProps {
    /** Category name */
    category: string;
    /** Score 0-100 */
    score: number;
    /** Weight from rubric (0.0-1.0) */
    weight: number;
    /** LLM justification */
    justification: string;
    /** Stagger index for animation delay */
    index: number;
}

/**
 * Animated horizontal score bar for a single rubric category.
 * Fills from 0% to the score with a smooth CSS transition.
 */
export default function ScoreBar({ category, score, weight, justification, index }: ScoreBarProps) {
    const color = score >= 80
        ? { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' }
        : score >= 60
        ? { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' }
        : { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' };

    const rating = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';

    return (
        <div
            className="animate-fade-slide-up opacity-0"
            style={{ animationDelay: `${index * 120}ms`, animationFillMode: 'forwards' }}
        >
            <div className={`bg-neutral-800/60 border border-neutral-700/40 rounded-xl p-4 hover:border-neutral-600/60 transition-colors ${color.glow} shadow-lg`}>
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{category}</h4>
                        <span className="shrink-0 text-[10px] font-medium text-neutral-500 bg-neutral-700/50 px-1.5 py-0.5 rounded">
                            {(weight * 100).toFixed(0)}%
                        </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${color.text}`}>
                            {rating}
                        </span>
                        <span className={`text-xl font-black tabular-nums ${color.text}`}>
                            {score}
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-neutral-700/50 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${color.bar} rounded-full transition-all duration-1000 ease-out`}
                        style={{
                            width: `${score}%`,
                            transitionDelay: `${index * 120 + 300}ms`,
                        }}
                    />
                </div>

                {/* Justification */}
                <p className="text-xs text-neutral-400 mt-2.5 leading-relaxed">
                    {justification}
                </p>
            </div>
        </div>
    );
}
