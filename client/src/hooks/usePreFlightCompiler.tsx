import { useState, useCallback } from 'react';
import type { CompileResponse, CompiledSimulation } from '../types/stagedSimulation';
import { COMPILE_URL } from '../config';
import { saveStages } from '../utils/sessionStore';

/**
 * usePreFlightCompiler acts as the bridge to the Resonance "Compiler" engine.
 * 
 * In Resonance, scenarios (like an Interview) aren't just one prompt. They are a 
 * series of "Stages". This hook takes the user's high-level inputs and sends them 
 * to our Rust backend, which uses Gemini Flash 1.5 to "compile" or distribute 
 * those instructions into a structured multi-stage script.
 * 
 * @returns {Object} { compile, isCompiling, error, result }
 */
export const usePreFlightCompiler = () => {
    // UI states for the loading indicator and error handling
    const [isCompiling, setIsCompiling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<CompiledSimulation | null>(null);

    /**
     * compile triggers the actual API call to the Rust backend.
     * 
     * @param inputs - The raw text provided by the user (e.g., job description, company info).
     * @param compilationPrompt - The specialized prompt instructions that tell Gemini HOW to compile.
     * @param scenarioId - The ID of the current scenario (used for storage keying).
     */
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
            // Send the compilation request to the local Rust binary
            const response = await fetch(COMPILE_URL, {
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
            
            /**
             * Hume EVI has a character limit for its system prompt (approx 7k).
             * Since we are injecting these compiled stages as instructions, 
             * we validate that the LLM hasn't hallucinated an overly verbose prompt.
             */
            for (const stage of data.data.stages) {
                if (stage.prompt.length > 7000) {
                    console.warn(`[PreFlight] ⚠️ Stage "${stage.title}" prompt is ${stage.prompt.length} chars (limit: 7000)`);
                }
            }

            // Persistence: We store the compiled script in sessionStorage so that
            // when the user navigates from "Pre-flight" to "Simulation",
            // the `useEviManager` hook can pick it up.
            saveStages(scenarioId, data.data);

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
