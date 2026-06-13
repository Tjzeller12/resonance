import type { CompiledSimulation } from '../types/stagedSimulation';

/**
 * Typed sessionStorage access for the pre-flight → simulation handoff.
 *
 * Home / StagedIntakePanel / usePreFlightCompiler write here before
 * navigating; useEviManager / useStageDirector read on the simulation page.
 * Keeping the keys and (de)serialization in one place prevents the key
 * strings and JSON.parse boilerplate from drifting across files.
 */

const stagesKey = (scenarioId: string) => `stages_${scenarioId}`;
const contextKey = (scenarioId: string) => `context_${scenarioId}`;
const backgroundKey = (scenarioId: string) => `staged_simulation_bg_${scenarioId}`;

function readJson<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch (e) {
        console.error(`[SessionStore] Failed to parse "${key}":`, e);
        return null;
    }
}

// ── Compiled stages ──

export function saveStages(scenarioId: string, data: CompiledSimulation): void {
    sessionStorage.setItem(stagesKey(scenarioId), JSON.stringify(data));
}

export function loadStages(scenarioId: string): CompiledSimulation | null {
    const compiled = readJson<CompiledSimulation>(stagesKey(scenarioId));
    return compiled && compiled.stages.length > 0 ? compiled : null;
}

// ── Appearance / persona context ──

export function saveContext(scenarioId: string, context: Record<string, string>): void {
    sessionStorage.setItem(contextKey(scenarioId), JSON.stringify(context));
}

export function loadContext(scenarioId: string): Record<string, string> | null {
    return readJson<Record<string, string>>(contextKey(scenarioId));
}

export function clearContext(scenarioId: string): void {
    sessionStorage.removeItem(contextKey(scenarioId));
}

// ── Custom background image ──

export function saveCustomBackground(scenarioId: string, imageUrl: string): void {
    sessionStorage.setItem(backgroundKey(scenarioId), imageUrl);
}

export function loadCustomBackground(scenarioId: string): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(backgroundKey(scenarioId));
}
