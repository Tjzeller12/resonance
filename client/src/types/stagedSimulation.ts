// ─── Shared types for the Staged Simulation Engine ──────────────────────────

/** A single stage of a multi-stage simulation */
export interface SimulationStage {
  id: string;
  title: string;
  /** The system prompt for this stage (≤1800 chars), sent as systemPrompt */
  prompt: string;
  /** Optional persistent context appended to user messages */
  context?: string;
  /** Hint for how long this stage should last, e.g. "2-3 questions" */
  duration_hint?: string;
}

/** Output from the pre-flight LLM compilation */
export interface CompiledSimulation {
  summary: string;
  stages: SimulationStage[];
}

/** API response from /api/compile */
export interface CompileResponse {
  success: boolean;
  data?: CompiledSimulation;
  error?: string;
}

/** Configuration for the staged intake UI */
export interface StagedIntakeConfig {
  title: string;
  subtitle: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    maxLength: number;
    multiline?: boolean;
    type?: "text" | "imageSelect" | "pillSelect";
    options?: Array<{ id: string; label: string; imagePath?: string; description?: string }>;
  }>;
  /** Instructions sent to the pre-flight LLM for compilation */
  compilationPrompt: string;
}
