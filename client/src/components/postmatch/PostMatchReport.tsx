import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AnalysisResult } from '../../types/conversationAnalysis';
import { getScenarioDisplayName } from '../../data/scenarios';
import ScoreBar from './ScoreBar';
import HighlightCard from './HighlightCard';
import TrainingCard from './TrainingCard';

interface PostMatchReportProps {
    result: AnalysisResult;
    scenarioId: string;
    sessionDurationMs: number;
    onTryAgain: () => void;
}

/**
 * PostMatchReport — The premium post-session review dashboard.
 *
 * Replaces the simulation view after analysis completes. Shows a full
 * breakdown of performance with animated score bars, highlight reel,
 * overall feedback, and training recommendations.
 */
export default function PostMatchReport({
    result,
    scenarioId,
    sessionDurationMs,
    onTryAgain,
}: PostMatchReportProps) {
    const navigate = useNavigate();
    const [displayXp, setDisplayXp] = useState(0);

    const scenarioName = getScenarioDisplayName(scenarioId);
    const durationMin = Math.floor(sessionDurationMs / 60000);
    const durationSec = Math.floor((sessionDurationMs % 60000) / 1000);

    // Animated XP counter
    useEffect(() => {
        const target = result.total_xp;
        const duration = 1500; // ms
        const startTime = performance.now();

        const tick = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayXp(Math.round(target * eased));
            if (progress < 1) requestAnimationFrame(tick);
        };

        // Small delay so the entrance animation plays first
        const timer = setTimeout(() => requestAnimationFrame(tick), 400);
        return () => clearTimeout(timer);
    }, [result.total_xp]);

    const strengths = result.highlights.filter(h => h.highlight_type === 'strength');
    const weaknesses = result.highlights.filter(h => h.highlight_type === 'weakness');

    return (
        <div className="min-h-screen bg-neutral-950 text-white overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* ── Hero Section ── */}
                <div className="animate-fade-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
                    <div className="text-center mb-10">
                        {/* Back link */}
                        <button
                            onClick={() => void navigate('/')}
                            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-6 inline-flex items-center gap-1 cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Home
                        </button>

                        {/* Label */}
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3">
                            Post-Match Report
                        </div>

                        {/* Scenario name */}
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-linear-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent mb-4">
                            {scenarioName}
                        </h1>

                        {/* Session stats */}
                        <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
                            <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {durationMin}m {durationSec}s
                            </span>
                            <span className="w-1 h-1 rounded-full bg-neutral-700" />
                            <span>{result.category_scores.length} categories</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-700" />
                            <span>{result.highlights.length} highlights</span>
                        </div>

                        {/* XP Display */}
                        <div className="mt-8">
                            <div className="inline-flex items-baseline gap-2">
                                <span className="text-6xl sm:text-7xl font-black tabular-nums text-white">
                                    {displayXp}
                                </span>
                                <span className="text-2xl font-bold text-emerald-400">XP</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Score Breakdown ── */}
                <section className="mb-10">
                    <div className="animate-fade-slide-up opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                        <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">
                            Category Breakdown
                        </h2>
                    </div>
                    <div className="flex flex-col gap-3">
                        {result.category_scores.map((cat, i) => (
                            <ScoreBar
                                key={cat.category}
                                category={cat.category}
                                score={cat.score}
                                weight={cat.weight}
                                justification={cat.justification}
                                index={i}
                            />
                        ))}
                    </div>
                </section>

                {/* ── Highlight Reel ── */}
                {result.highlights.length > 0 && (
                    <section className="mb-10">
                        <div className="animate-fade-slide-up opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
                            <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">
                                Highlight Reel
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Strengths column */}
                            {strengths.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    {strengths.map((h, i) => (
                                        <HighlightCard key={`s-${i}`} highlight={h} index={i} />
                                    ))}
                                </div>
                            )}

                            {/* Weaknesses column */}
                            {weaknesses.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    {weaknesses.map((h, i) => (
                                        <HighlightCard key={`w-${i}`} highlight={h} index={i + strengths.length} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Overall Feedback ── */}
                <section className="mb-10">
                    <div
                        className="animate-fade-slide-up opacity-0"
                        style={{ animationDelay: '800ms', animationFillMode: 'forwards' }}
                    >
                        <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">
                            Coach&apos;s Analysis
                        </h2>
                        <div className="bg-neutral-900/60 border border-neutral-700/40 rounded-xl p-5">
                            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                                {result.overall_feedback}
                            </p>
                        </div>
                    </div>
                </section>

                {/* ── Training Recommendations ── */}
                {result.suggested_training.length > 0 && (
                    <section className="mb-10">
                        <div
                            className="animate-fade-slide-up opacity-0"
                            style={{ animationDelay: '900ms', animationFillMode: 'forwards' }}
                        >
                            <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">
                                Recommended Training
                            </h2>
                        </div>
                        <div className="flex flex-col gap-2">
                            {result.suggested_training.map((t, i) => (
                                <TrainingCard key={t.module_id} training={t} index={i} onSelectTraining={onTryAgain} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Action Bar ── */}
                <div
                    className="animate-fade-slide-up opacity-0"
                    style={{ animationDelay: '1100ms', animationFillMode: 'forwards' }}
                >
                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-neutral-800">
                        <button
                            onClick={() => void navigate('/')}
                            className="px-6 py-2.5 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer"
                        >
                            Back to Home
                        </button>
                        <button
                            onClick={onTryAgain}
                            className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                        >
                            Try Again →
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
