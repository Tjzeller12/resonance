import { useState, useCallback, useMemo } from 'react';
import type { SimulationStage, CompiledSimulation } from '../types/stagedSimulation';

/**
 * Manages the active stage during a Hume EVI session.
 * Reads compiled stages from sessionStorage and handles stage transitions
 * triggered by the AI's `advance_stage` tool call.
 */
export const useStageDirector = (
    scenarioId: string,
    sendSessionSettings: (settings: Record<string, unknown>) => void,
) => {
    // Read stages from sessionStorage synchronously on first render
    const initialData = useMemo(() => {
        const raw = typeof window !== 'undefined'
            ? sessionStorage.getItem(`stages_${scenarioId}`)
            : null;
        if (!raw) return null;
        try {
            const compiled = JSON.parse(raw) as CompiledSimulation;
            if (compiled.stages.length > 0) {
                console.log(`[Director] Loaded ${compiled.stages.length} stages:`,
                    compiled.stages.map(s => s.title));
                return compiled;
            }
        } catch (e) {
            console.error('[Director] Failed to parse staged data:', e);
        }
        return null;
    }, [scenarioId]);

    const [stages] = useState<SimulationStage[]>(initialData?.stages ?? []);
    const [summary] = useState<string>(initialData?.summary ?? '');
    const isStaged = stages.length > 0;
    const [stageIndex, setStageIndex] = useState(0);

    const currentStage = stages[stageIndex] ?? null;
    const totalStages = stages.length;
    const isLastStage = stageIndex >= totalStages - 1;

    /**
     * Returns the initial system prompt for stage 0.
     * Called by useEviManager at connect time.
     */
    const getInitialPrompt = useCallback((): string | null => {
        if (stages.length === 0) return null;
        console.log(`[Director] Initial prompt: "${stages[0].title}" (${stages[0].prompt.length} chars)`);
        return stages[0].prompt;
    }, [stages]);

    /**
     * Advances to the next stage by hot-swapping the systemPrompt
     * via sendSessionSettings. Called when the AI triggers advance_stage.
     */
    const advanceStage = useCallback(() => {
        const nextIndex = stageIndex + 1;

        if (nextIndex >= totalStages) {
            console.log('[Director] 🏁 All stages complete!');
            // Send a final context to let the AI know we're wrapping up
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

        // Append explicit instruction for tool use
        const promptWithTool = `${nextStage.prompt}\n\nIMPORTANT: Once the requirements for this stage are complete, use the 'advance_stage' tool call to move on to the next stage.`;

        // Hot-swap the system prompt for the new stage
        sendSessionSettings({
            type: 'session_settings',
            systemPrompt: promptWithTool,
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
