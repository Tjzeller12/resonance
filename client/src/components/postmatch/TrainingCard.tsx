import { useNavigate } from 'react-router-dom';
import type { SuggestedTraining } from '../../types/conversationAnalysis';

/** Maps module IDs to their display images from homeConfigs */
const MODULE_IMAGES: Record<string, string> = {
    downward_inflection_technique_training: '/resources/sim_env_imgs/dojo.png',
    pitch_variance_training: '/resources/sim_env_imgs/dojo.png',
    pace_and_volume_variance_training: '/resources/sim_env_imgs/dojo.png',
    speaking_intelligence_training: '/resources/sim_env_imgs/dojo.png',
    star_interview_training: '/resources/sim_env_imgs/interview_training.png',
    masculine_frame_training: '/resources/sim_env_imgs/dating_training.png',
    playground_training: '/resources/sim_env_imgs/dojo.png',
};

interface TrainingCardProps {
    training: SuggestedTraining;
    /** Stagger index for animation delay */
    index: number;
    /** Callback to close the postmatch overlay when navigating */
    onSelectTraining: () => void;
}

/**
 * Clickable card for a suggested training module.
 * Links directly to the training simulation.
 */
export default function TrainingCard({ training, index, onSelectTraining }: TrainingCardProps) {
    const navigate = useNavigate();
    const image = MODULE_IMAGES[training.module_id] || '/resources/sim_env_imgs/dojo.png';

    const handleClick = () => {
        onSelectTraining();
        void navigate(`/simulation?scenarioId=${training.module_id}&mode=training`);
    };

    return (
        <div
            className="animate-fade-slide-up opacity-0"
            style={{ animationDelay: `${900 + index * 120}ms`, animationFillMode: 'forwards' }}
        >
            <button
                onClick={handleClick}
                className="w-full group bg-neutral-800/50 border border-neutral-700/40 rounded-xl p-3 
                           hover:border-blue-500/40 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10
                           transition-all duration-300 cursor-pointer text-left flex items-center gap-3"
            >
                {/* Module thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-neutral-700/50">
                    <img
                        src={image}
                        alt={training.module_name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {training.module_name}
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {training.reason}
                    </p>
                </div>

                {/* Arrow */}
                <div className="shrink-0 text-neutral-600 group-hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>
        </div>
    );
}
