import { useVoice } from '@humeai/voice-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const SIM_CONFIGS = {
    interview: {
        image: '/resources/sim_env_imgs/interview_at_tech.png',
        configId: "d7f0c27e-7425-4764-96f4-fc24453fbd30", 
    },
    bar_pickup: {
        image: '/resources/sim_env_imgs/pickup_at_bar.png',
        configId: "b19dd7d0-68df-4700-a5f6-54dabe3ba021", 
    },
    dojo: {
        image: '/resources/sim_env_imgs/dojo.png',
        configId: "b055deb3-a413-4543-83d7-09f30c71b2a6", 
    }
};

export const useEviManager = () => {
    const { connect, disconnect, status, messages, isMuted, mute, unmute, pauseAssistant, resumeAssistant } = useVoice();
    const [searchParams] = useSearchParams();
    const simParam = searchParams.get('sim') || 'dojo';
    // Use type assertion safely, ensuring keyof typeof SIM_CONFIGS
    const activeConfig: { image: string , configId?: string } = (simParam in SIM_CONFIGS) 
        ? SIM_CONFIGS[simParam as keyof typeof SIM_CONFIGS] 
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
