import { useVoice } from '@humeai/voice-react';
import type { Hume } from 'hume';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

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
        configId: "940686cb-95e5-4ff7-b384-128b2e330269", 
    },
    speaking_intelligence_training: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "6f47b2e8-c530-4510-a756-1d7b6a47ec1f", 
    },
    star_interview_training: {
        image: '/resources/sim_env_imgs/interview_training.png',
        configId: "838d4afb-2927-4975-82b5-d4b75a17db62", 
    },
    interview: {
        image: '/resources/sim_env_imgs/interview_at_tech.png',
        configId: "d7f0c27e-7425-4764-96f4-fc24453fbd30", 
    },
    masculine_frame_training: {
        image: '/resources/sim_env_imgs/dating_training.png',
        configId: "184abf66-e8bd-4c30-8b4f-b4e1b3b68150", 
    },
    bar_pickup: {
        image: '/resources/sim_env_imgs/pickup_at_bar.png',
        configId: "b19dd7d0-68df-4700-a5f6-54dabe3ba021", 
    },
    high_end_dinner_date: {
        image: '/resources/sim_env_imgs/high_end_dinner_date.png',
        configId: "2af8f2e3-3e4d-4337-9fb6-78408dc07dbb", 
    },
    park_date: {
        image: '/resources/sim_env_imgs/park_date.png',
        configId: "90422709-e1e5-4e90-94fe-9f5feab5028a", 
    },
};

export const useEviManager = () => {
    const { connect, disconnect, status, messages, isMuted, mute, unmute, pauseAssistant, resumeAssistant, isPlaying, isPaused, sendSessionSettings } = useVoice();
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || 'downward_inflection_technique_training';
    
    const baseConfig: { image: string , configId?: string } = (scenarioId in SIM_CONFIGS) 
        ? SIM_CONFIGS[scenarioId] 
        : SIM_CONFIGS.downward_inflection_technique_training;
        
    const customBgImg = sessionStorage.getItem(`staged_simulation_bg_${scenarioId}`);
    
    const activeConfig = {
        ...baseConfig,
        image: customBgImg || baseConfig.image
    };

    // Read injected context from sessionStorage (set by ContextInjectionPanel)
    const contextRaw = typeof window !== 'undefined' 
        ? sessionStorage.getItem(`context_${scenarioId}`) 
        : null;
    const contextData: Record<string, string> | null = contextRaw 
        ? (JSON.parse(contextRaw) as Record<string, string>) 
        : null;

    // Build a natural-language context string
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

    const startEviSession = useCallback(async () => {
        try {
            const apiKey = String(import.meta.env.VITE_HUME_API_KEY ?? '');
            const contextText = contextData ? buildContextString(contextData) : null;

            // Check for staged simulation data (from pre-flight compiler)
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
                stagePromptLength: initialStagePrompt?.length,
            });

            // Build connect options
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

            if (initialStagePrompt) {
                // Staged simulation: override system prompt with stage 1
                // Add explicit instruction for tool use to ensure EVI knows when to advance
                const promptWithTool = `${initialStagePrompt}\n\nIMPORTANT: Once the requirements for this stage are complete, use the 'advance_stage' tool call to move on to the next stage.`;
                sessionSettings.systemPrompt = promptWithTool;
                console.log(`[EVI] Staged mode: stage 1 prompt (${promptWithTool.length} chars)`);
            } else if (contextText) {
                // Context injection (dating): append to user messages
                sessionSettings.context = {
                    text: contextText,
                    type: 'persistent',
                };
            }

            const hasSessionSettings = sessionSettings.systemPrompt || sessionSettings.context || sessionSettings.tools;

            await connect({
                auth: { type: 'apiKey', value: apiKey },
                ...(activeConfig.configId ? { configId: activeConfig.configId } : {}),
                ...(hasSessionSettings ? { sessionSettings: sessionSettings as Hume.empathicVoice.SessionSettings } : {}),
            });

            console.log('[EVI] Connected.');

            // Post-connect: also send context via sendSessionSettings (belt)
            if (contextText && !initialStagePrompt) {
                try {
                    sendSessionSettings({
                        context: {
                            text: contextText,
                            type: 'persistent',
                        },
                    });
                    console.log('[EVI] ✅ sendSessionSettings context sent');
                } catch (e) {
                    console.warn('[EVI] ⚠️ sendSessionSettings failed:', e);
                }
            }

            // Clean up session data after connect
            if (contextData) {
                sessionStorage.removeItem(`context_${scenarioId}`);
            }
        } catch (err) {
            console.error('Failed to connect to Hume EVI', err);
        }
    }, [connect, activeConfig.configId, contextData, scenarioId, sendSessionSettings]);

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
