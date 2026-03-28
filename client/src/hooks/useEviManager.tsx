import { useVoice } from '@humeai/voice-react';
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
    tech_interview: {
        image: '/resources/sim_env_imgs/interview_at_tech.png',
        configId: "d7f0c27e-7425-4764-96f4-fc24453fbd30", 
    },
    fin_interview: {
        image: '/resources/sim_env_imgs/finance_interview.png',
        configId: "1b68a8ca-2b74-4e1c-ae52-095cf21775ae", 
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
    
    const activeConfig: { image: string , configId?: string } = (scenarioId in SIM_CONFIGS) 
        ? SIM_CONFIGS[scenarioId] 
        : SIM_CONFIGS.downward_inflection_technique_training;

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

            console.log('[EVI] Starting session...', {
                scenarioId,
                configId: activeConfig.configId,
                hasContext: !!contextText,
                contextText,
            });

            // 1. Connect with context in session settings
            await connect({
                auth: { type: 'apiKey', value: apiKey },
                ...(activeConfig.configId ? { configId: activeConfig.configId } : {}),
                ...(contextText ? {
                    sessionSettings: {
                        type: 'session_settings' as const,
                        context: {
                            text: contextText,
                            type: 'persistent' as const,
                        },
                    },
                } : {}),
            });

            console.log('[EVI] Connected.');

            if (contextText) {
                // Send context via sendSessionSettings after connect
                // This sends a WebSocket message that Hume appends to user messages
                try {
                    sendSessionSettings({
                        context: {
                            text: contextText,
                            type: 'persistent',
                        },
                    });
                    console.log('[EVI] ✅ sendSessionSettings sent');
                    // Store on window for console debugging: type window.__eviContext in console
                    (window as unknown as Record<string, unknown>).__eviContext = contextText;
                } catch (e) {
                    console.warn('[EVI] ⚠️ sendSessionSettings failed:', e);
                }

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
