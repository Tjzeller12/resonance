import { useVoice } from '@humeai/voice-react';
import type { Hume } from 'hume';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * SIM_CONFIGS serves as a mapping between scenario identifiers and their 
 * specific visual/AI configurations.
 * 
 * - image: The background scene shown on the HUD.
 * - configId: The Hume EVI Config UUID that dictates the AI's core instructions and tools.
 */
const SIM_CONFIGS: Record<string, { image: string; configId?: string }> = {
    downward_inflection_technique_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "b055deb3-a413-4543-83d7-09f30c71b2a6", 
    },
    pitch_variance_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    pace_and_volume_variance_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    speaking_intelligence_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    star_interview_training: {
        image: '/resources/sim_env_imgs/interview_training.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    tech_interview: {
        image: '/resources/sim_env_imgs/interview_at_tech.png',
        configId: "d7f0c27e-7425-4764-96f4-fc24453fbd30", 
    },
    finance_interview: {
        image: '/resources/sim_env_imgs/finance_interview.png',
        configId: "d7f0c27e-7425-4764-96f4-fc24453fbd30", 
    },
    masculine_frame_training: {
        image: '/resources/sim_env_imgs/dating_training.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    playground_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "53a940d4-f863-4d84-af96-f45dc26b7e78", 
    },
    bar: {
        image: '/resources/sim_env_imgs/pickup_at_bar.png',
        configId: "2af8f2e3-3e4d-4337-9fb6-78408dc07dbb", 
    },
    park: {
        image: '/resources/sim_env_imgs/park_date.png',
        configId: "2af8f2e3-3e4d-4337-9fb6-78408dc07dbb", 
    },
    dinner: {
        image: '/resources/sim_env_imgs/high_end_dinner_date.png',
        configId: "2af8f2e3-3e4d-4337-9fb6-78408dc07dbb", 
    },
};

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
    const scenarioId = searchParams.get('scenarioId') || 'downward_inflection_technique_training';
    
    // Resolve which config we should use
    const baseConfig: { image: string , configId?: string } = (scenarioId in SIM_CONFIGS) 
        ? SIM_CONFIGS[scenarioId] 
        : SIM_CONFIGS.downward_inflection_technique_training;
        
    // Optionally use a custom image if the pre-flight check set one in sessionStorage
    const customBgImg = sessionStorage.getItem(`staged_simulation_bg_${scenarioId}`);
    
    const activeConfig = {
        ...baseConfig,
        image: customBgImg || baseConfig.image
    };

    // Load appearance/persona context injected by the user in the "Pre-flight" screens
    const contextRaw = typeof window !== 'undefined' 
        ? sessionStorage.getItem(`context_${scenarioId}`) 
        : null;
    const contextData: Record<string, string> | null = contextRaw 
        ? (JSON.parse(contextRaw) as Record<string, string>) 
        : null;

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
            const stagedRaw = typeof window !== 'undefined'
                ? sessionStorage.getItem(`stages_${scenarioId}`)
                : null;
            interface StagedData { stages: Array<{ prompt: string; title: string }> }
            const stagedData = stagedRaw ? (JSON.parse(stagedRaw) as StagedData) : null;
            const initialStagePrompt = stagedData?.stages?.[0]?.prompt ?? null;

            console.log('[EVI] Starting session...', {
                scenarioId,
                configId: activeConfig.configId,
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
                const promptWithTool = `${initialStagePrompt}\n\nIMPORTANT: Once the requirements for this stage are complete, use the 'advance_stage' tool call to move on to the next stage.`;
                sessionSettings.systemPrompt = promptWithTool;
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
                ...(activeConfig.configId ? { configId: activeConfig.configId } : {}),
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
                sessionStorage.removeItem(`context_${scenarioId}`);
            }
        } catch (err) {
            console.error('Failed to connect to Hume EVI', err);
        }
    }, [connect, activeConfig.configId, contextData, scenarioId, sendSessionSettings]);

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
