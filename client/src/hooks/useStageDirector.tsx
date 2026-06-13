import { useState, useCallback, useMemo } from 'react';
import type { SimulationStage } from '../types/stagedSimulation';
import { withAdvanceStageInstruction } from '../data/scenarios';
import { loadStages } from '../utils/sessionStore';

/**
 * useStageDirector is the "Script Manager" for multi-part simulations.
 * 
 * DESIGN RATIONALE:
 * Large language models perform better when they have focused instructions for a 
 * single task. Instead of giving Hume one massive prompt for a 30-minute interview,
 * we split it into stages (e.g. "Introductions", "Technical Deep Dive", "Closing").
 * 
 * This hook manages the logic of moving through those stages by "Hot-swapping" 
 * the AI's instructions during the call.
 * 
 * @param scenarioId - The current scenario ID to load scripts for.
 * @param sendSessionSettings - The function from useVoice to update EVI instructions.
 * @returns {Object} { isStaged, stages, currentStage, stageIndex, totalStages, isLastStage, summary, advanceStage }
 */
export const useStageDirector = (
    scenarioId: string,
    sendSessionSettings: (settings: Record<string, unknown>) => void,
) => {
    /**
     * STAGE LOADING:
     * We load the compiled stages from sessionStorage. These were placed there 
     * by the `usePreFlightCompiler` during the screen preceding the simulation.
     */
    const initialData = useMemo(() => {
        const compiled = loadStages(scenarioId);
        if (compiled) {
            console.log(`[Director] Loaded ${compiled.stages.length} stages:`,
                compiled.stages.map(s => s.title));
        }
        return compiled;
    }, [scenarioId]);

    // Internal state to track progress through the script
    const [stages] = useState<SimulationStage[]>(initialData?.stages ?? []);
    const [summary] = useState<string>(initialData?.summary ?? '');
    const isStaged = stages.length > 0;
    const [stageIndex, setStageIndex] = useState(0);

    const currentStage = stages[stageIndex] ?? null;
    const totalStages = stages.length;
    const isLastStage = stageIndex >= totalStages - 1;

    /**
     * getInitialPrompt returns the first stage's instructions.
     * This is conventionally used during the initial connect() call to Hume.
     */
    const getInitialPrompt = useCallback((): string | null => {
        if (stages.length === 0) return null;
        return stages[0].prompt;
    }, [stages]);

    /**
     * advanceStage: THE CORE TRANSITION LOGIC
     * 
     * This is called by the Parent component (Simulation.tsx) when it hears the AI 
     * trigger the 'advance_stage' tool call.
     * 
     * It uses `sendSessionSettings` to tell the AI its new instructions.
     * EVI handles this "Hot-swap" without dropping the connection or 
     * losing the conversational history.
     */
    const advanceStage = useCallback(() => {
        const nextIndex = stageIndex + 1;

        if (nextIndex >= totalStages) {
            console.log('[Director] 🏁 All stages complete!');
            // Send a final "Wrap-up" instruction
            sendSessionSettings({
                type: 'session_settings',
                context: {
                    text: 'All interview stages are complete. Wrap up the conversation naturally and thank the candidate.',
                    type: 'persistent',
                },
            });
            return;
        }

        const nextStage = stages[nextIndex];
        console.log(`[Director] Advancing to stage ${nextIndex + 1}/${totalStages}: "${nextStage.title}"`);

        // UPDATE THE AI IN-REAL-TIME
        // (re-append the tool instruction so EVI remembers it can advance)
        sendSessionSettings({
            type: 'session_settings',
            systemPrompt: withAdvanceStageInstruction(nextStage.prompt),
            ...(nextStage.context ? {
                context: {
                    text: nextStage.context,
                    type: 'persistent',
                },
            } : {}),
        });
 
        setStageIndex(nextIndex);
    }, [stageIndex, totalStages, stages, sendSessionSettings]);

    return {
        isStaged,
        stages,
        currentStage,
        stageIndex,
        totalStages,
        isLastStage,
        summary,
        getInitialPrompt,
        advanceStage,
    };
};
