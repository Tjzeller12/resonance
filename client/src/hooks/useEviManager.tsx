import { useVoice } from '@humeai/voice-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const SIM_CONFIGS: Record<string, { image: string; configId?: string }> = {
    dojo: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "b055deb3-a413-4543-83d7-09f30c71b2a6", 
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
    const { connect, disconnect, status, messages, isMuted, mute, unmute, pauseAssistant, resumeAssistant } = useVoice();
    const [searchParams] = useSearchParams();
    const scenarioId = searchParams.get('scenarioId') || 'dojo';
    
    // Use type assertion safely, ensuring keyof typeof SIM_CONFIGS
    const activeConfig: { image: string , configId?: string } = (scenarioId in SIM_CONFIGS) 
        ? SIM_CONFIGS[scenarioId] 
        : SIM_CONFIGS.dojo;

    const startEviSession = useCallback(async () => {
        try {
            const apiKey = import.meta.env.VITE_HUME_API_KEY;
                
            await connect({
                auth: { type: 'apiKey', value: apiKey },
                ...(activeConfig.configId ? { configId: activeConfig.configId } : {}),
                sessionSettings: {
                    type: 'session_settings',
                }
            });
        } catch (err) {
            console.error('Failed to connect to Hume EVI', err);
        }
    }, [connect, activeConfig.configId]);

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
        activeConfig
    };
};
