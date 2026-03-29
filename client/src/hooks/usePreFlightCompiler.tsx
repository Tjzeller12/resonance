import { useState, useCallback } from 'react';
import type { CompileResponse, CompiledSimulation } from '../types/stagedSimulation';

const COMPILE_ENDPOINT = 'http://localhost:3000/api/compile';

/**
 * Hook that calls the Rust backend's /api/compile endpoint
 * to compile large text inputs into structured simulation stages
 * via Gemini Flash 3.
 */
export const usePreFlightCompiler = () => {
    const [isCompiling, setIsCompiling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CompiledSimulation | null>(null);

    const compile = useCallback(async (
        inputs: Record<string, string>,
        compilationPrompt: string,
        scenarioId: string,
    ): Promise<CompiledSimulation | null> => {
        setIsCompiling(true);
        setError(null);
        setResult(null);

        console.log('[PreFlight] Compiling...', { inputKeys: Object.keys(inputs), scenarioId });

        try {
            const response = await fetch(COMPILE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    inputs,
                    compilation_prompt: compilationPrompt,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server error ${response.status}: ${text}`);
            }

            const data = (await response.json()) as CompileResponse;

            if (!data.success || !data.data) {
                throw new Error(data.error || 'Compilation failed with no error message');
            }

            console.log('[PreFlight] ✅ Compiled', data.data.stages.length, 'stages');
            
            // Validate stage prompts are within Hume's limit
            for (const stage of data.data.stages) {
                if (stage.prompt.length > 2000) {
                    console.warn(`[PreFlight] ⚠️ Stage "${stage.title}" prompt is ${stage.prompt.length} chars (limit: 2000)`);
                }
            }

            // Store in sessionStorage for the simulation page to read
            sessionStorage.setItem(
                `stages_${scenarioId}`,
                JSON.stringify(data.data),
            );

            setResult(data.data);
            return data.data;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Unknown compilation error';
            console.error('[PreFlight] ❌ Error:', msg);
            setError(msg);
            return null;
        } finally {
            setIsCompiling(false);
        }
    }, []);

    return { compile, isCompiling, error, result };
};
