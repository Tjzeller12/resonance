import type { Highlight } from '../../types/conversationAnalysis';

interface HighlightCardProps {
    highlight: Highlight;
    /** Stagger index for animation delay */
    index: number;
}

/**
 * A card showing a single strength or weakness moment.
 * Green left border for strengths, red for weaknesses.
 */
export default function HighlightCard({ highlight, index }: HighlightCardProps) {
    const isStrength = highlight.highlight_type === 'strength';

    const accent = isStrength
        ? { border: 'border-l-emerald-500', icon: '✦', iconColor: 'text-emerald-400', bg: 'bg-emerald-500/5' }
        : { border: 'border-l-red-500', icon: '⚠', iconColor: 'text-red-400', bg: 'bg-red-500/5' };

    return (
        <div
            className="animate-fade-slide-up opacity-0"
            style={{ animationDelay: `${600 + index * 100}ms`, animationFillMode: 'forwards' }}
        >
            <div className={`${accent.bg} border border-neutral-700/40 border-l-4 ${accent.border} rounded-xl p-4 hover:border-neutral-600/60 transition-colors`}>
                {/* Type label */}
                <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-sm ${accent.iconColor}`}>{accent.icon}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${accent.iconColor}`}>
                        {isStrength ? 'Strength' : 'Needs Work'}
                    </span>
                </div>

                {/* Transcript snippet */}
                <blockquote className="text-sm text-neutral-200 font-medium leading-relaxed mb-2 pl-3 border-l-2 border-neutral-600 italic">
                    &ldquo;{highlight.transcript_snippet}&rdquo;
                </blockquote>

                {/* Explanation */}
                <p className="text-xs text-neutral-400 leading-relaxed">
                    {highlight.explanation}
                </p>

                {/* Suggestion */}
                {highlight.suggestion && (
                    <div className="mt-3 pt-2.5 border-t border-neutral-700/40">
                        <p className="text-xs text-neutral-300 leading-relaxed">
                            <span className="font-bold text-neutral-400">Coaching: </span>
                            {highlight.suggestion}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
