import { useVoice } from '@humeai/voice-react';
import type { Hume } from 'hume';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_SCENARIO_ID, getScenarioConfig, withAdvanceStageInstruction } from '../data/scenarios';
import { clearContext, loadContext, loadCustomBackground, loadStages } from '../utils/sessionStore';

/**
 * useEviManager is the primary orchestrator for the Hume Empathic Voice Interface (EVI).
 *
 * It handles:
 * 1. Selecting the correct AI configuration based on the URL's scenarioId.
 * 2. Compiling and injecting "Appearance Context" (e.g., how the AI/User looks).
 * 3. Initializing the session with 'staged' simulation data if available.
 * 4. Configuring global tools like 'advance_stage'.
 *
 * @returns An object containing session controls, status, and message history.
 */
export const useEviManager = () => {
    // voice-react provides the underlying WebSocket connection and audio handling
    const {
        connect,
        disconnect,
        status,
        messages,
        isMuted,
        mute,
        unmute,
        pauseAssistant,
        resumeAssistant,
        isPlaying,
        isPaused,
        sendSessionSettings
    } = useVoice();

    // Determine the scenario from the URL (e.g. ?scenarioId=tech_interview)
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || DEFAULT_SCENARIO_ID;

    // Resolve which config we should use
    const baseConfig = getScenarioConfig(scenarioId);

    // Optionally use a custom image if the pre-flight check set one in sessionStorage
    const customBgImg = loadCustomBackground(scenarioId);

    const activeConfig = {
        ...baseConfig,
        image: customBgImg || baseConfig.image
    };

    // Load appearance/persona context injected by the user in the "Pre-flight" screens
    const contextData = loadContext(scenarioId);

    /**
     * Converts raw key-value pair context data into a human-readable prompt
     * that can be injected as 'persistent context' into EVI.
     */
    const buildContextString = (context: Record<string, string>): string => {
        const parts: string[] = [];
        if (context.self_description?.trim()) {
            parts.push(`The user's physical appearance: ${context.self_description.trim()}`);
        }
        if (context.date_persona?.trim()) {
            parts.push(`The person they are interacting with looks like: ${context.date_persona.trim()}`);
        }
        const handled = new Set(['self_description', 'date_persona']);
        for (const [key, value] of Object.entries(context)) {
            if (!handled.has(key) && value.trim()) {
                parts.push(`${key.replace(/_/g, ' ')}: ${value.trim()}`);
            }
        }
        return parts.length > 0
            ? `Use the following appearance details about the participants. ${parts.join('. ')}.`
            : '';
    };

    /**
     * startEviSession initializes the WebSocket connection to Hume.
     *
     * It dynamically constructs 'SessionSettings' which can override the
     * default instructions for the given configId. This allows us to have
     * generic configs (like 'Interview') that behave differently based on the
     * precise scenario (e.g. 'Software Engineer' vs 'Accountant').
     */
    const startEviSession = useCallback(async () => {
        try {
            const apiKey = String(import.meta.env.VITE_HUME_API_KEY ?? '');
            const contextText = contextData ? buildContextString(contextData) : null;

            // Check if there's a staged simulation (a list of prompts/stages) to follow
            const initialStagePrompt = loadStages(scenarioId)?.stages[0]?.prompt ?? null;

            console.log('[EVI] Starting session...', {
                scenarioId,
                configId: activeConfig.humeConfigId,
                hasContext: !!contextText,
                hasStages: !!initialStagePrompt,
            });

            // Local type helper for session settings structure
            type SessionSettingsObj = {
                type: 'session_settings';
                systemPrompt?: string;
                context?: { text: string; type: 'persistent' };
                tools?: Array<{
                    type: 'function';
                    name: string;
                    description: string;
                    parameters: {
                        type: 'object';
                        properties: Record<string, unknown>;
                        required?: string[];
                    };
                }>;
            };

            // Common tools shared across all Resonance simulations
            const sessionSettings: SessionSettingsObj = {
                type: 'session_settings' as const,
                tools: [
                    {
                        type: 'function',
                        name: 'advance_stage',
                        description: 'Call this tool when the requirements for the current interview stage have been met and it is time to move on to the next stage of the interview. This will end the current stage and load the next one.',
                        parameters: {
                            type: 'object',
                            properties: {
                                reason: {
                                    type: 'string',
                                    description: 'A brief explanation of why the requirements for the current stage have been met and why you are advancing to the next stage.',
                                },
                            },
                            required: ['reason'],
                        },
                    }
                ]
            };

            // Priority: If we have stages (Interview mode), override the system prompt for stage 1.
            // Otherwise, if we have appearance context, inject it as persistent context.
            if (initialStagePrompt) {
                sessionSettings.systemPrompt = withAdvanceStageInstruction(initialStagePrompt);
                console.log(`[EVI] Staged mode: stage 1 prompt initialized.`);
            } else if (contextText) {
                sessionSettings.context = {
                    text: contextText,
                    type: 'persistent',
                };
            }

            const hasSessionSettings = sessionSettings.systemPrompt || sessionSettings.context || sessionSettings.tools;

            // ESTABLISH CONNECTION
            await connect({
                auth: { type: 'apiKey', value: apiKey },
                ...(activeConfig.humeConfigId ? { configId: activeConfig.humeConfigId } : {}),
                ...(hasSessionSettings ? { sessionSettings: sessionSettings as Hume.empathicVoice.SessionSettings } : {}),
            });

            console.log('[EVI] Connected.');

            // Fallback: If we had context but didn't use the initial session settings injection, send it now.
            if (contextText && !initialStagePrompt) {
                try {
                    sendSessionSettings({
                        context: {
                            text: contextText,
                            type: 'persistent',
                        },
                    });
                } catch (e) {
                    console.warn('[EVI] ⚠️ sendSessionSettings failed:', e);
                }
            }

            // Clean up to prevent stale data in future re-connections
            if (contextData) {
                clearContext(scenarioId);
            }
        } catch (err) {
            console.error('Failed to connect to Hume EVI', err);
        }
    }, [connect, activeConfig.humeConfigId, contextData, scenarioId, sendSessionSettings]);

    /**
     * Gracefully ends the AI connection
     */
    const stopEviSession = useCallback(() => {
        void disconnect();
    }, [disconnect]);

    return {
        startEviSession,
        stopEviSession,
        status,
        messages,
        isMuted,
        mute,
        unmute,
        pauseAssistant,
        resumeAssistant,
        activeConfig,
        isPlaying,
        isPaused,
        sendSessionSettings,
    };
};
