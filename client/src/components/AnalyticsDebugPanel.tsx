import { useState } from 'react';
import type { TurnAnalytics } from '../hooks/useVoiceAnalyticsEngine';

interface AnalyticsDebugPanelProps {
    traces: TurnAnalytics[];
}



export default function AnalyticsDebugPanel({ traces }: AnalyticsDebugPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (traces.length === 0 && !isOpen) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50" style={{ maxWidth: '480px' }}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="mb-2 px-3 py-1.5 rounded-lg bg-neutral-800/90 backdrop-blur-sm border border-neutral-600/50 text-xs font-bold text-neutral-300 hover:text-white hover:border-neutral-500 transition-all flex items-center gap-1.5"
            >
                🔬 Debug {isOpen ? '▼' : '▲'}
                {traces.length > 0 && (
                    <span className="bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                        {traces.length}
                    </span>
                )}
            </button>

            {/* Panel */}
            {isOpen && (
                <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-700/60 rounded-xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-neutral-800/50 border-b border-neutral-700/50">
                        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                            Voice Analytics Debugger
                        </div>
                    </div>

                    {/* Turn List */}
                    <div className="max-h-[400px] overflow-y-auto p-2 flex flex-col gap-2">
                        {traces.length === 0 && (
                            <div className="text-neutral-500 text-xs text-center py-6">
                                Waiting for first finalized turn...
                            </div>
                        )}

                        {[...traces].reverse().map((trace, i) => (
                            <TurnCard key={traces.length - 1 - i} trace={trace} index={traces.length - i} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function TurnCard({ trace, index }: { trace: TurnAnalytics; index: number }) {
    const [expanded, setExpanded] = useState(index === 1);
    const d = trace.debug;

    return (
        <div className="bg-neutral-800/60 rounded-lg border border-neutral-700/40 overflow-hidden">
            {/* Summary Row */}
            <button
                onClick={() => setExpanded(prev => !prev)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-neutral-700/30 transition-colors"
            >
                <span className="text-[10px] font-bold text-neutral-500 w-5">#{index}</span>
                <span className="text-xs text-neutral-300 truncate flex-1">
                    &quot;{trace.transcript.substring(0, 50)}{trace.transcript.length > 50 ? '...' : ''}&quot;
                </span>
                <span className="text-[10px] font-mono text-cyan-400">{d.trueWpm} WPM</span>
                <span className="text-[10px] text-neutral-500">{expanded ? '▾' : '▸'}</span>
            </button>

            {/* Expanded Details */}
            {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-neutral-700/30 space-y-2">
                    {/* Metrics */}
                    <Section title="📊 Sentence Metrics">
                        <Row label="Words" value={d.wordCount.toString()} />
                        <Row label="True WPM" value={d.trueWpm.toString()} />
                        <Row label="Avg Pitch" value={`${d.avgPitch}Hz`} />
                        <Row label="Pitch Range" value={`${d.pitchRange}Hz`} />
                        <Row label="Avg Volume" value={d.avgVolume.toFixed(3)} />
                        <Row label="Sensor Samples" value={d.sliceSampleCount.toString()} />
                    </Section>

                    {/* Clarity */}
                    <Section title="🎯 Clarity">
                        <Row label="Score" value={`${Math.round(d.clarityScore * 100)}%`} />
                        {d.mumbledWords.length > 0 && (
                            <Row
                                label="Mumbled"
                                value={d.mumbledWords.map(w => `"${w.word}" (${Math.round(w.confidence * 100)}%)`).join(', ')}
                            />
                        )}
                    </Section>

                    {/* Tags */}
                    <Section title="🏷️ Generated Tags">
                        <div className="flex flex-wrap gap-1">
                            {trace.tags.map((tag, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold border border-cyan-500/20"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </Section>
                </div>
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">{title}</div>
            <div className="space-y-0.5">{children}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-500">{label}</span>
            <span className="text-neutral-200 font-mono text-[11px]">{value}</span>
        </div>
    );
}
