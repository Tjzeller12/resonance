import type { ContextField } from "../components/ContextInjectionPanel";
import type { StagedIntakeConfig } from "../types/stagedSimulation";

export interface ContextConfig {
  title: string;
  subtitle?: string;
  fields: ContextField[];
  quickChips?: string[];
  chipTargetField?: string;
}

export interface ScenarioItem {
  id: string;
  label: string;
  image: string;
  contextConfig?: ContextConfig;
  stagedIntakeConfig?: StagedIntakeConfig;
}

export interface Category {
  id: string;
  title: string;
  description: string;
  image: string;
  color: string;
  border: string;
  trainingOptions: ScenarioItem[];
  practiceOptions: ScenarioItem[];
}

export const DATING_CONTEXT_CONFIG: ContextConfig = {
  title: "Setup Your Date",
  subtitle: "Define the traits and scenario for an incredibly realistic dating simulation.",
  fields: [
    {
      key: "self_appearance",
      label: "Your Appearance",
      placeholder: "e.g. Tall, athletic build, short dark hair, wearing a fitted henley...",
      maxLength: 250,
    },
    {
      key: "date_appearance",
      label: "Their Appearance",
      placeholder: "e.g. Petite, curly auburn hair, light freckles, wearing a sundress...",
      maxLength: 250,
    },
    {
      key: "scenario",
      label: "The Scenario",
      placeholder: "Select where the date is happening",
      maxLength: 100,
      type: "imageSelect",
      options: [
        { id: "bar", label: "Dive Bar", imagePath: "/resources/sim_env_imgs/pickup_at_bar.png" },
        { id: "dinner", label: "Nice Restaurant", imagePath: "/resources/sim_env_imgs/high_end_dinner_date.png" },
        { id: "park", label: "Park Walk", imagePath: "/resources/sim_env_imgs/park_date.png" }
      ]
    },
    {
      key: "personality",
      label: "Their Personality",
      placeholder: "Select their vibe",
      maxLength: 100,
      type: "pillSelect",
      options: [
        { id: "shy_nervous", label: "Shy & Nervous", description: "Sweet but timid. Needs you to take the lead." },
        { id: "warm_playful", label: "Warm & Playful", description: "Optimistic, witty, hates 'interview' questions." },
        { id: "guarded_sarcastic", label: "Guarded & Sarcastic", description: "Skeptical, tests you, zero tolerance for creeps or nerves." },
        { id: "random", label: "Surprise Me (Random)", description: "Randomly pick an archetype." }
      ]
    }
  ]
};

export const INTERVIEW_COMPILATION_PROMPT = `You are an expert interview coach creating a structured interview plan.
Given the candidate's resume and the job description, design a 4-stage mock interview.

Rules for each stage prompt:
- Must be ≤1800 characters
- Must be a COMPLETE, self-contained system prompt for a voice AI interviewer
- Include specific questions the AI should ask based on the resume/JD
- Include grading criteria hints (what makes a good vs bad answer)
- The AI should act as a professional interviewer throughout
- VERY IMPORTANT: For Stages 1, 2, and 3, EXPLICITLY instruct the AI that it must NOT wrap up or conclude the interview. It must ONLY state that it is moving to the next section and then immediately execute the 'advance_stage' tool call.
- Only in Stage 4 should the AI wrap up the interview and conclude normally.
- PERSONALITY: If a 'personality' input is provided, infuse EVERY stage's system prompt to strongly embody that personality/vibe. If the personality is 'random', creatively choose a distinct, compelling personality for the AI (e.g., erratic CEO, aggressive stress-tester, overly supportive mentor) and explicitly specify it in the generated prompts.

Stages should be:
1. Icebreaker & Behavioral (warmup, tell me about yourself, why this role)
2. Role-Specific Behavioral (STAR-method questions based on the JD requirements)
3. Technical/Domain Knowledge (role-specific technical questions)
4. Candidate Questions & Wrap-up (let them ask questions, give closing feedback)

Return ONLY valid JSON.`;

export const INTERVIEW_INTAKE_CONFIG: StagedIntakeConfig = {
  title: "Interview Setup",
  subtitle: "Paste your resume and the target job description. We'll compile a structured interview.",
  fields: [
    {
      key: "resume",
      label: "Your Resume",
      placeholder: "Paste your resume text here...",
      maxLength: 5000,
      multiline: true,
    },
    {
      key: "job_description",
      label: "Job Description",
      placeholder: "Paste the job posting / description here...",
      maxLength: 3000,
      multiline: true,
    },
    {
      key: "personality",
      label: "Interviewer Personality",
      placeholder: "Select a personality",
      maxLength: 100,
      type: "pillSelect",
      options: [
        { id: "kind_mentor", label: "The Kind Mentor", description: "Supportive, encouraging, looking for potential." },
        { id: "stress_tester", label: "The Stress-Tester", description: "Cold, objective, asks tough follow-ups, pushes for depth." },
        { id: "vibe_check", label: "The Culture Match", description: "Casual, informal, focuses heavily on vibe and how you work." },
        { id: "random", label: "Surprise Me (Random)", description: "The AI will pick a random, distinct personality for the simulation." },
      ]
    },
    {
      key: "environment",
      label: "Environment Style",
      placeholder: "Select your interview environment",
      maxLength: 100,
      type: "imageSelect",
      options: [
        { id: "tech", label: "Tech Office", imagePath: "/resources/sim_env_imgs/interview_at_tech.png" },
        { id: "finance", label: "Finance Office", imagePath: "/resources/sim_env_imgs/finance_interview.png" }
      ]
    },
  ],
  compilationPrompt: INTERVIEW_COMPILATION_PROMPT,
};

export const CATEGORIES: Category[] = [
  {
    id: "general",
    title: "General Social",
    description:
      "Everyday conversations to build confidence and conversational agility.",
    image: "/resources/sim_env_imgs/dojo.png",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    trainingOptions: [
      {
        id: "downward_inflection_technique_training",
        label: "Downward Inflection & Pausing",
        image: "/resources/sim_env_imgs/dojo.png",
      },
      {
        id: "pitch_variance_training",
        label: "Pitch Variance Training",
        image: "/resources/sim_env_imgs/dojo.png",
      },
      {
        id: "pace_and_volume_variance_training",
        label: "Pace & Volume Variance Training",
        image: "/resources/sim_env_imgs/dojo.png",
      },
      {
        id: "speaking_intelligence_training",
        label: "Sounding Intelligent",
        image: "/resources/sim_env_imgs/dojo.png",
      },
    ],
    practiceOptions: [],
  },
  {
    id: "interview",
    title: "Interview Prep",
    description:
      "High-stakes practice for technical and behavioral interviews.",
    image: "/resources/sim_env_imgs/interview_at_tech.png",
    color: "from-purple-500/20 to-purple-600/5",
    border: "border-purple-500/30",
    trainingOptions: [      
        {
        id: "star_interview_training",
        label: "STAR technique",
        image: "/resources/sim_env_imgs/interview_training.png",
      },
    ],
    practiceOptions: [
      {
        id: "interview",
        label: "Interview",
        image: "/resources/sim_env_imgs/interview_at_tech.png",
        stagedIntakeConfig: INTERVIEW_INTAKE_CONFIG,
      },
    ],
  },
  {
    id: "dating",
    title: "Dating & Romance",
    description: "Read the room, practice flirting, and test your charm.",
    image: "/resources/sim_env_imgs/pickup_at_bar.png",
    color: "from-rose-500/20 to-rose-600/5",
    border: "border-rose-500/30",
    trainingOptions: [
      {
        id: "masculine_frame_training",
        label: "Masculine Frame Techniques",
        image: "/resources/sim_env_imgs/dating_training.png",
      },
    ],
    practiceOptions: [
      {
        id: "dating",
        label: "Dating Simulator",
        image: "/resources/sim_env_imgs/high_end_dinner_date.png",
        contextConfig: DATING_CONTEXT_CONFIG,
      },
    ],
  },
];
