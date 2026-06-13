import { useState } from 'react';
import { usePreFlightCompiler } from '../hooks/usePreFlightCompiler';
import type { StagedIntakeConfig, SimulationStage } from '../types/stagedSimulation';
import { INTERVIEW_PERSONALITIES } from '../data/homeConfigs';
import { saveCustomBackground, saveStages } from '../utils/sessionStore';
import { Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

interface StagedIntakePanelProps {
    config: StagedIntakeConfig;
    scenarioId: string;
    onLaunch: () => void;
    onCancel: () => void;
}

type Step = 'input' | 'compiling' | 'review';

export default function StagedIntakePanel({
    config,
    scenarioId,
    onLaunch,
    onCancel,
}: StagedIntakePanelProps) {
    const [step, setStep] = useState<Step>('input');
    const [values, setValues] = useState<Record<string, string>>(
        Object.fromEntries(config.fields.map((f) => [f.key, f.defaultValue || '']))
    );
    const [compiledStages, setCompiledStages] = useState<SimulationStage[]>([]);
    const [compiledSummary, setCompiledSummary] = useState('');
    const { compile, isCompiling, error } = usePreFlightCompiler();

    const handleChange = (key: string, value: string, maxLength: number) => {
        if (value.length <= maxLength) {
            setValues((prev) => ({ ...prev, [key]: value }));
        }
    };

    const hasContent = Object.values(values).some((v) => v.trim().length > 0);

    const handleCompile = async () => {
        setStep('compiling');
        
        // Resolve random personality before sending to compiler
        const processedValues = { ...values };
        let selectedPersonalityId = processedValues.personality;

        if (selectedPersonalityId === 'random') {
            const personalityField = config.fields.find(f => f.key === 'personality');
            if (personalityField?.options) {
                const otherOptions = personalityField.options.filter(o => o.id !== 'random');
                if (otherOptions.length > 0) {
                    const randomOpt = otherOptions[Math.floor(Math.random() * otherOptions.length)];
                    selectedPersonalityId = randomOpt.id;
                    processedValues.personality = randomOpt.id;
                    console.log(`[StagedIntake] Resolved 'random' personality to: ${randomOpt.id}`);
                }
            }
        }

        // Inject the chosen personality's label into the prompt so Gemini knows the vibe
        let finalPrompt = config.compilationPrompt;
        const personalityConfig = INTERVIEW_PERSONALITIES[selectedPersonalityId];
        if (personalityConfig) {
            finalPrompt = finalPrompt.replace('{personality_label}', personalityConfig.label);
        } else {
            finalPrompt = finalPrompt.replace('{personality_label}', selectedPersonalityId);
        }

        const result = await compile(processedValues, finalPrompt, scenarioId);
        if (result) {
            // DETERMINISTIC INJECTION: Prepend the hardcoded AI directives to each generated stage
            const injectedStages = result.stages.map(stage => ({
                ...stage,
                prompt: personalityConfig 
                    ? `${personalityConfig.aiDescription}\n\n${stage.prompt}`
                    : stage.prompt
            }));

            // Store the injected version (overwriting the raw version from usePreFlightCompiler)
            saveStages(scenarioId, { ...result, stages: injectedStages });

            setCompiledStages(injectedStages);
            setCompiledSummary(result.summary);
            
            // DEBUG: Verify first stage injection
            console.log(`[StagedIntake] ✅ Personality "${selectedPersonalityId}" injected. First stage prompt sample:`, 
                injectedStages[0].prompt.slice(0, 300) + "..."
            );

            // Log full plan for user review
            console.log("==================================================");
            console.log("📋 FULL COMPILED INTERVIEW PLAN");
            console.log("==================================================");
            injectedStages.forEach((s, i) => {
                console.log(`\n--- STAGE ${i + 1}: ${s.title} (${s.prompt.length} chars) ---`);
                console.log(s.prompt);
                if (s.duration_hint) console.log(`Duration: ${s.duration_hint}`);
            });
            console.log("\n==================================================");
            
            setStep('review');
        } else {
            // Error — go back to input to let user retry
            setStep('input');
        }
    };

    const handleLaunch = () => {
        if (values.environment) {
            saveCustomBackground(scenarioId, values.environment);
        }

        // Filter out disabled stages before starting
        const activeStages = compiledStages.filter(s => !s.disabled);

        if (activeStages.length === 0) {
            alert("Please enable at least one stage to start.");
            return;
        }

        // Final sync of ONLY active stages to sessionStorage
        saveStages(scenarioId, { summary: compiledSummary, stages: activeStages });

        onLaunch();
    };

    const handleToggleStage = (index: number) => {
        setCompiledStages(prev => prev.map((s, i) => 
            i === index ? { ...s, disabled: !s.disabled } : s
        ));
    };

    const handleMoveStage = (index: number, direction: 'up' | 'down') => {
        const newStages = [...compiledStages];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (swapIndex < 0 || swapIndex >= newStages.length) return;

        [newStages[index], newStages[swapIndex]] = [newStages[swapIndex], newStages[index]];
        setCompiledStages(newStages);
    };

    // ─── Input Step ─────────────────────────────────────────────────

    if (step === 'input' || step === 'compiling') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                    {/* Header */}
                    <div className="px-6 pt-6 pb-4 border-b border-neutral-800">
                        <h2 className="text-2xl font-bold text-white">{config.title}</h2>
                        <p className="text-sm text-neutral-400 mt-1">{config.subtitle}</p>
                    </div>

                    {/* Fields */}
                    <div className="px-6 py-5 flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
                        {config.fields.map((field) => (
                            <div key={field.key} className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-neutral-300 tracking-wide">
                                    {field.label}
                                </label>
                                {field.type === 'imageSelect' ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {field.options?.map((opt) => (
                                            <div
                                                key={opt.id}
                                                onClick={() => handleChange(field.key, opt.imagePath as string, 1000)}
                                                className={`cursor-pointer rounded-xl border p-2 transition-all ${
                                                    values[field.key] === opt.imagePath
                                                        ? 'bg-blue-500/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02]'
                                                        : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-500 hover:bg-neutral-700'
                                                }`}
                                            >
                                                <img src={opt.imagePath} alt={opt.label} className="w-full h-24 object-cover rounded-lg mb-2" />
                                                <p className="text-center text-sm font-semibold text-white">{opt.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : field.type === 'pillSelect' ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {field.options?.map((opt) => (
                                            <div
                                                key={opt.id}
                                                onClick={() => handleChange(field.key, opt.id, 1000)}
                                                className={`cursor-pointer rounded-xl border p-3 flex flex-col justify-center gap-1 transition-all ${
                                                    values[field.key] === opt.id
                                                        ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-[1.02]'
                                                        : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-500 hover:bg-neutral-700'
                                                }`}
                                            >
                                                <div className="text-sm font-bold text-white text-center">{opt.label}</div>
                                                {opt.description && (
                                                    <div className="text-xs text-neutral-400 text-center leading-tight">
                                                        {opt.description}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <textarea
                                            value={values[field.key]}
                                            onChange={(e) =>
                                                handleChange(field.key, e.target.value, field.maxLength)
                                            }
                                            placeholder={field.placeholder}
                                            rows={field.multiline ? 8 : 3}
                                            disabled={isCompiling}
                                            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors disabled:opacity-50"
                                        />
                                        <div className="text-xs text-neutral-500 text-right tabular-nums">
                                            <span
                                                className={
                                                    (values[field.key]?.length || 0) >= field.maxLength * 0.9
                                                        ? 'text-amber-400'
                                                        : ''
                                                }
                                            >
                                                {values[field.key]?.length || 0}
                                            </span>
                                            /{field.maxLength}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {/* Error display */}
                        {error && (
                            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                ⚠️ {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                        <button
                            onClick={onCancel}
                            disabled={isCompiling}
                            className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => void handleCompile()}
                            disabled={!hasContent || isCompiling}
                            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                                hasContent && !isCompiling
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                            }`}
                        >
                            {isCompiling ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Compiling...
                                </>
                            ) : (
                                'Compile & Preview →'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Review Step ─────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-neutral-800">
                    <h2 className="text-2xl font-bold text-white">Stage Preview</h2>
                    <p className="text-sm text-neutral-400 mt-1">{compiledSummary}</p>
                </div>

                {/* Stage List */}
                <div className="px-6 py-5 flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {compiledStages.map((stage, i) => (
                        <div
                            key={stage.id}
                            className={`flex items-start gap-4 p-4 border rounded-xl transition-all ${
                                stage.disabled 
                                    ? 'bg-neutral-900/40 border-neutral-800 opacity-50 grayscale-[0.5]' 
                                    : 'bg-neutral-800/60 border-neutral-700/40'
                            }`}
                        >
                            {/* Stage number */}
                            <div className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                                stage.disabled 
                                    ? 'bg-neutral-800 border-neutral-700' 
                                    : 'bg-blue-600/20 border-blue-500/30'
                            }`}>
                                <span className={`text-sm font-bold ${stage.disabled ? 'text-neutral-500' : 'text-blue-400'}`}>
                                    {i + 1}
                                </span>
                            </div>

                            {/* Stage info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className={`text-sm font-semibold truncate ${stage.disabled ? 'text-neutral-500 line-through' : 'text-white'}`}>
                                        {stage.title}
                                    </h3>
                                    {stage.disabled && (
                                        <span className="text-[10px] font-bold text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 uppercase tracking-tighter">
                                            Disabled
                                        </span>
                                    )}
                                </div>
                                {stage.duration_hint && (
                                    <p className="text-xs text-neutral-500 mt-0.5">{stage.duration_hint}</p>
                                )}
                                <p className="text-xs text-neutral-400 mt-1 line-clamp-1 italic opacity-60">
                                    {stage.prompt.slice(0, 100)}...
                                </p>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                <div className="flex flex-col gap-1 mr-2 border-r border-neutral-800 pr-2">
                                    <button
                                        onClick={() => handleMoveStage(i, 'up')}
                                        disabled={i === 0}
                                        className="p-1 text-neutral-500 hover:text-blue-400 disabled:opacity-20 transition-colors"
                                    >
                                        <ChevronUp size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleMoveStage(i, 'down')}
                                        disabled={i === compiledStages.length - 1}
                                        className="p-1 text-neutral-500 hover:text-blue-400 disabled:opacity-20 transition-colors"
                                    >
                                        <ChevronDown size={14} />
                                    </button>
                                </div>

                                <button
                                    onClick={() => handleToggleStage(i)}
                                    title={stage.disabled ? "Enable Stage" : "Disable Stage"}
                                    className={`p-2 rounded-lg transition-all ${
                                        stage.disabled 
                                            ? 'text-neutral-500 hover:text-green-400 bg-neutral-800' 
                                            : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-700/50'
                                    }`}
                                >
                                    {stage.disabled ? <Eye size={18} /> : <EyeOff size={18} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
                    <button
                        onClick={() => setStep('input')}
                        className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer"
                    >
                        ← Back to Edit
                    </button>
                    <button
                        onClick={handleLaunch}
                        className="px-6 py-2.5 text-sm font-bold rounded-xl bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20 transition-all duration-200 cursor-pointer"
                    >
                        Start Simulation →
                    </button>
                </div>
            </div>
        </div>
    );
}
