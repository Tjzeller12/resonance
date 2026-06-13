/**
 * Scenario registry — the single source of truth for per-scenario runtime
 * configuration (background image, Hume EVI config, session mode).
 *
 * Adding a new scenario means adding one entry here; useEviManager and
 * useConversationData both read from this map.
 */

/** Session mode reported to the post-match analyzer. */
export type SessionMode = 'evi_sim' | 'training' | 'dojo';

export interface ScenarioRuntimeConfig {
    /** Human-readable name shown in reports. */
    displayName: string;
    /** Background scene shown on the simulation HUD. */
    image: string;
    /** Hume EVI Config UUID that dictates the AI's core instructions and tools. */
    humeConfigId?: string;
    /** How the post-match analyzer should treat this session. */
    mode: SessionMode;
}

/** Hume EVI config UUIDs, named by the persona they implement. */
const HUME_CONFIG = {
    inflectionCoach: 'b055deb3-a413-4543-83d7-09f30c71b2a6',
    generalCoach: '53a940d4-f863-4d84-af96-f45dc26b7e78',
    interviewer: 'd7f0c27e-7425-4764-96f4-fc24453fbd30',
    datingPartner: '2af8f2e3-3e4d-4337-9fb6-78408dc07dbb',
} as const;

const IMG = '/resources/sim_env_imgs';

export const SCENARIOS: Record<string, ScenarioRuntimeConfig> = {
    downward_inflection_technique_training: {
        displayName: 'Downward Inflection Training',
        image: `${IMG}/dojo.png`,
        humeConfigId: HUME_CONFIG.inflectionCoach,
        mode: 'dojo',
    },
    pitch_variance_training: {
        displayName: 'Pitch Variance Training',
        image: `${IMG}/dojo.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'dojo',
    },
    pace_and_volume_variance_training: {
        displayName: 'Pace & Volume Training',
        image: `${IMG}/dojo.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'dojo',
    },
    playground_training: {
        displayName: 'Playground',
        image: `${IMG}/dojo.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'dojo',
    },
    speaking_intelligence_training: {
        displayName: 'Speaking Intelligence',
        image: `${IMG}/dojo.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'training',
    },
    star_interview_training: {
        displayName: 'STAR Method Training',
        image: `${IMG}/interview_training.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'training',
    },
    masculine_frame_training: {
        displayName: 'Masculine Frame Training',
        image: `${IMG}/dating_training.png`,
        humeConfigId: HUME_CONFIG.generalCoach,
        mode: 'training',
    },
    tech_interview: {
        displayName: 'Tech Interview',
        image: `${IMG}/interview_at_tech.png`,
        humeConfigId: HUME_CONFIG.interviewer,
        mode: 'evi_sim',
    },
    finance_interview: {
        displayName: 'Finance Interview',
        image: `${IMG}/finance_interview.png`,
        humeConfigId: HUME_CONFIG.interviewer,
        mode: 'evi_sim',
    },
    bar: {
        displayName: 'Dive Bar Date',
        image: `${IMG}/pickup_at_bar.png`,
        humeConfigId: HUME_CONFIG.datingPartner,
        mode: 'evi_sim',
    },
    park: {
        displayName: 'Park Walk Date',
        image: `${IMG}/park_date.png`,
        humeConfigId: HUME_CONFIG.datingPartner,
        mode: 'evi_sim',
    },
    dinner: {
        displayName: 'Restaurant Date',
        image: `${IMG}/high_end_dinner_date.png`,
        humeConfigId: HUME_CONFIG.datingPartner,
        mode: 'evi_sim',
    },
};

export const DEFAULT_SCENARIO_ID = 'downward_inflection_technique_training';

/** Resolves a scenario's runtime config, falling back to the default scenario. */
export function getScenarioConfig(scenarioId: string): ScenarioRuntimeConfig {
    return SCENARIOS[scenarioId] ?? SCENARIOS[DEFAULT_SCENARIO_ID];
}

/** Resolves a human-readable scenario name, falling back to the raw ID. */
export function getScenarioDisplayName(scenarioId: string): string {
    return SCENARIOS[scenarioId]?.displayName ?? scenarioId;
}

/** Resolves the session mode for the post-match analyzer. */
export function getScenarioMode(scenarioId: string): SessionMode {
    return SCENARIOS[scenarioId]?.mode ?? 'evi_sim';
}

/**
 * Instruction appended to every staged-simulation system prompt so EVI
 * remembers it can advance to the next stage via tool call.
 */
export const ADVANCE_STAGE_INSTRUCTION =
    "IMPORTANT: Once the requirements for this stage are complete, use the 'advance_stage' tool call to move on to the next stage.";

export function withAdvanceStageInstruction(prompt: string): string {
    return `${prompt}\n\n${ADVANCE_STAGE_INSTRUCTION}`;
}
