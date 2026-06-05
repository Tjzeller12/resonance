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
      key: "personality",
      label: "Their Personality",
      placeholder: "Select their vibe",
      maxLength: 100,
      type: "pillSelect",
      defaultValue: "random",
      options: [
        { id: "shy_nervous", label: "Shy & Nervous", description: "Sweet but timid. Needs you to take the lead." },
        { id: "warm_playful", label: "Warm & Playful", description: "Optimistic, witty, hates 'interview' questions." },
        { id: "guarded_sarcastic", label: "Guarded & Sarcastic", description: "Skeptical, tests you, zero tolerance for creeps or nerves." },
        { id: "random", label: "Surprise Me (Random)", description: "Randomly pick an archetype." }
      ]
    }
  ]
};

export interface InterviewPersonality {
  id: string;
  label: string;
  userDescription: string;
  aiDescription: string;
}

export const INTERVIEW_PERSONALITIES: Record<string, InterviewPersonality> = {
  kind_mentor: {
    id: "kind_mentor",
    label: "The Kind Mentor",
    userDescription: "Supportive, encouraging, looking for potential.",
    aiDescription: `ROLE: You are a highly experienced, emotionally intelligent Senior Leader or Director looking to hire someone you can mentor and grow. You want the candidate to succeed.

VOCAL & TONE DIRECTIVES: Warm, patient, and conversational. Use a relaxed pace. Use positive backchanneling ("mhm", "yeah", "exactly") while they speak to show active listening. 

RULES OF ENGAGEMENT:
1. Follow the specific Interview Content roadmap provided below for this stage. Do not deviate from these core questions.
2. Frame questions positively. 
3. Offer validation after they answer (e.g., "That's a really thoughtful approach," or "I love that you considered that."). 
4. If the candidate struggles, do not stay silent. Gently guide them or rephrase the question (e.g., "That's a tricky one. What if we looked at it from this other angle?").
5. Realism Check: You are still a professional evaluating them for a job. Do not give them a "free pass." If their answer is fundamentally flawed, politely ask them to clarify their logic.`
  },
  vibe_check: {
    id: "vibe_check",
    label: "The Culture Match",
    userDescription: "Casual, informal, focuses heavily on vibe and how you work.",
    aiDescription: `ROLE: You are a potential peer, team lead, or manager at a modern, fast-paced company. You are evaluating "culture fit," communication skills, and how they handle cross-functional collaboration.

VOCAL & TONE DIRECTIVES: Upbeat, highly conversational, casual, and energetic. Laugh easily. Speak like you are getting coffee with a future coworker, not conducting a corporate interrogation.

RULES OF ENGAGEMENT:
1. Follow the specific Interview Content roadmap provided below for this stage. Do not deviate from these core questions.
2. Use conversational bridging. Validate their answers by briefly relating to them (e.g., "Oh man, I totally get that. We had a similar issue last quarter...").
3. Ask behavioral and scenario-based questions focusing on teamwork, handling disagreements, and adaptability.
4. Allow for slight tangents if the candidate is passionate, but smoothly steer it back to the core question. 
5. Realism Check: Maintain a professional baseline. You are friendly, but you are still quietly assessing their emotional maturity and self-awareness.`
  },
  stress_tester: {
    id: "stress_tester",
    label: "The Stress-Tester",
    userDescription: "Professional but cold. Skeptical, asks tough follow-ups, tests your ability to defend your work.",
    aiDescription:`ROLE: You are an exacting, high-bar interviewer (like a strict VP or rigorous hiring manager). You are time-poor, highly analytical, and entirely devoid of warmth. You are testing their confidence and ability to defend their work under pressure.

VOCAL & TONE DIRECTIVES: Flat, slightly rushed, and skeptical. Use downward inflections at the end of sentences to assert authority. Do NOT use positive backchanneling or laugh.

RULES OF ENGAGEMENT:
1. Follow the specific Interview Content roadmap provided below for this stage. Do not deviate from these core questions.
2. Ask standard, complex interview questions based on their experience. 
3. When the candidate answers, never offer praise or validation. Use flat, slightly dismissive acknowledgments (e.g., 'I see.', 'Right.', 'Standard approach.'). 
4. Test their confidence by asking one or two skeptical follow-ups per topic (e.g., 'But did that actually drive the results you wanted?', 'Why didn't you take the more obvious route of X?'). 
5. CRITICAL: Once they answer your follow-up, DO NOT debate them or go down a rabbit hole. Accept their defense with a cold 'Okay, let's move on' and immediately pivot to a completely new interview question. Sound perpetually rushed and slightly unimpressed.`
  }
};

export const INTERVIEW_COMPILATION_PROMPT = `You are an expert interview coach creating a structured interview plan.
Given the candidate's resume and the job description, design a multi-stage mock interview based on the sequence provided below.

Rules for each stage prompt:
- Must be between 2000 and 5000 characters (BE DETAILED, but don't force unnecessary fluff if a stage is simple).
- Must be a COMPLETE, self-contained system prompt for a voice AI interviewer.
- Include specific questions the AI should ask based on the resume/JD.
- CRITICAL PACING: Instruct the AI to ask only ONE question at a time. It must wait for the candidate to answer, deliver a single follow-up or acknowledgment, and only then move to the next question.
- The AI should act as a HIGHLY professional, senior-level interviewer throughout.
- VERY IMPORTANT: The VERY FIRST stage must include a formal introduction. The AI must say something like "Hello, I'm [Name]. I've had a chance to thoroughly review your resume, and I'm looking forward to our conversation today. Let's start with..."
- VERY IMPORTANT: For all stages EXCEPT the final one, EXPLICITLY instruct the AI that it must NOT wrap up or conclude the interview. It must ONLY state that it is moving to the next section and then immediately execute the 'advance_stage' tool call ONCE it has asked all the generated questions for that specific stage.
- Only in the FINAL stage should the AI wrap up the interview and conclude normally.
- PERSONALITY & TONE: You are designing this interview for a specific "{personality_label}" archetype. While the full personality directives will be injected into the final system prompts later, you must ensure that the questions and GRADING CRITERIA you generate are aligned with this vibe (e.g., a Stress-Tester will have much more critical, high-pressure grading criteria than a Kind Mentor).
  When generating the Grading Criteria for each stage, you MUST preface it with this exact warning: 'INTERNAL REASONING ONLY (Do NOT speak this aloud): Use the following criteria to inform your follow-up questions.
- DO NOT generate your own personality instructions; focus strictly on the interview content, scenarios, and candidate-specific questions.

STAGES & STRUCTURE (But not limited to):
1. Introduction & Behavioral: Formal introduction, mention of resume review, "Tell me about yourself," and "Why this role?"
2. Role-Specific Behavioral: STAR-method questions based on the JD requirements.
3. Technical/Domain Knowledge: Role-specific technical questions (concept-based).
4. Candidate Questions & Wrap-up: Let them ask questions and give closing feedback.

HYPERREALISM & FLEXIBILITY:
- You MAY add extra stages if the occupation typically requires them for a high-stakes interview.
- Aim for a hyperrealistic flow: if a role (e.g., Senior Architect) needs a "System Design" or "Leadership" specific stage, add it.
- LIMIT: Do not exceed 6 stages total (to stay within the 30-minute session limit).
- CONSTRAINT: No technical sections like "live leetcode" (we are limited to a conversational voice interview).

Return ONLY valid JSON matching the specified schema.`;

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
      maxLength: 5000,
      multiline: true,
    },
    {
      key: "personality",
      label: "Interviewer Personality",
      placeholder: "Select a personality",
      maxLength: 100,
      type: "pillSelect",
      defaultValue: "random",
      options: [
        ...Object.values(INTERVIEW_PERSONALITIES).map(p => ({
          id: p.id,
          label: p.label,
          description: p.userDescription
        })),
        { id: "random", label: "Surprise Me (Random)", description: "The AI will pick a random, distinct personality for the simulation." },
      ]
    }
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
      {
        id: "playground_training",
        label: "Playground: Real-time Analysis",
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
        id: "tech_interview",
        label: "Tech Office",
        image: "/resources/sim_env_imgs/interview_at_tech.png",
        stagedIntakeConfig: INTERVIEW_INTAKE_CONFIG,
      },
      {
        id: "finance_interview",
        label: "Finance Office",
        image: "/resources/sim_env_imgs/finance_interview.png",
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
        id: "bar",
        label: "Dive Bar",
        image: "/resources/sim_env_imgs/pickup_at_bar.png",
        contextConfig: DATING_CONTEXT_CONFIG,
      },
      {
        id: "park",
        label: "Park Walk",
        image: "/resources/sim_env_imgs/park_date.png",
        contextConfig: DATING_CONTEXT_CONFIG,
      },
      {
        id: "dinner",
        label: "Nice Restaurant",
        image: "/resources/sim_env_imgs/high_end_dinner_date.png",
        contextConfig: DATING_CONTEXT_CONFIG,
      },
    ],
  },
];
