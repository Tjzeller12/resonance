use serde::Serialize;

// ─── Rubric Types ───────────────────────────────────────────────────────────

/// A scoring rubric that defines how a session should be evaluated.
#[derive(Debug, Clone, Serialize)]
pub struct Rubric {
    pub mode: String,
    pub focus: RubricFocus,
    pub categories: Vec<RubricCategory>,
}

/// What aspect of the session the rubric prioritizes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RubricFocus {
    Conversation,
    Vocal,
    Both,
}

/// A single scoring category within a rubric.
#[derive(Debug, Clone, Serialize)]
pub struct RubricCategory {
    /// Display name (e.g. "Vocal Clarity", "Answer Structure")
    pub name: String,
    /// Context-specific grading guidance for the LLM evaluator.
    /// Tells the AI exactly what to look for and how to interpret this category
    /// within the specific scenario (e.g. what "Humor & Wit" means on a date vs. interview).
    pub description: String,
    /// Weight for XP calculation (0.0 - 1.0, all categories should sum to 1.0)
    pub weight: f32,
    /// Which analytics metrics to reference (e.g. "clarity_score", "wpm", "pitch_range")
    pub metrics: Vec<String>,
    /// Score thresholds for qualitative ratings
    pub thresholds: Thresholds,
}

/// Score boundaries for qualitative assessments.
#[derive(Debug, Clone, Serialize)]
pub struct Thresholds {
    /// Score >= this is "Excellent"
    pub excellent: u32,
    /// Score >= this is "Good"
    pub good: u32,
    /// Score >= this is "Needs Work"
    pub needs_work: u32,
}

// ─── Rubric Lookup ──────────────────────────────────────────────────────────

/// Look up the appropriate rubric for a given scenario and mode.
///
/// Returns a default rubric if no specific match is found,
/// ensuring every session gets a meaningful evaluation.
pub fn get_rubric(scenario_id: &str) -> Rubric {
    match scenario_id {
        // ── Interview Simulations ──
        "tech_interview" | "finance_interview" => interview_rubric(scenario_id),

        // ── Dating Simulations ──
        "bar" | "park" | "dinner" => dating_rubric(scenario_id),

        // ── Vocal Training (Dojo) ──
        "downward_inflection_technique_training" | "pitch_variance_training"
        | "pace_and_volume_variance_training" => dojo_rubric(scenario_id),

        // ── Content Training ──
        "star_interview_training" => star_rubric(),
        "speaking_intelligence_training" => speaking_intelligence_rubric(),
        "masculine_frame_training" => masculine_frame_rubric(),

        // ── Playground / Fallback ──
        "playground_training" => playground_rubric(),
        _ => default_rubric(scenario_id),
    }
}

// ─── Rubric Definitions ─────────────────────────────────────────────────────

fn interview_rubric(scenario_id: &str) -> Rubric {
    Rubric {
        mode: scenario_id.to_string(),
        focus: RubricFocus::Both,
        categories: vec![
            RubricCategory {
                name: "Answer Structure".to_string(),
                description: "Evaluate whether answers are well-organized and concise. \
                    Strong answers have a clear thesis up front, 2-3 supporting points, and a \
                    definitive conclusion — not rambling chronological stories. Penalize answers \
                    that bury the lead, go on tangents, or fail to directly address what was asked. \
                    Reward candidates who demonstrate the ability to synthesize complex experiences \
                    into tight, persuasive narratives.".to_string(),
                weight: 0.25,
                metrics: vec!["transcript_coherence".into(), "response_length".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Confidence Projection".to_string(),
                description: "Assess vocal indicators of confidence in a professional interview \
                    setting. Look for steady pitch (not shaky or wavering), downward inflections \
                    at sentence endings (commands vs. asks), appropriate volume (not whispering \
                    or shouting), and a measured pace that doesn't rush through points. Penalize \
                    vocal fry, uptalk on statements, and audible nervousness (voice cracking, \
                    trailing off). A confident interviewee sounds like they belong in the room.".to_string(),
                weight: 0.25,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Filler Word Avoidance".to_string(),
                description: "Count and penalize filler words ('um', 'uh', 'like', 'you know', \
                    'basically', 'sort of'). In a professional interview, fillers signal lack of \
                    preparation and erode perceived competence. An occasional filler in a long \
                    response is human; constant fillers suggest the candidate is thinking out loud \
                    rather than delivering prepared thoughts. Also check clarity — mumbled or \
                    swallowed words count against articulation.".to_string(),
                weight: 0.20,
                metrics: vec!["filler_count".into(), "clarity_score".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Pacing Consistency".to_string(),
                description: "Evaluate speaking pace across the session. Ideal interview pacing \
                    is 130-160 WPM — fast enough to be engaging, slow enough to be clear. Penalize \
                    consistent rushing (>180 WPM, signals nervousness) or dragging (<100 WPM, \
                    signals uncertainty). Reward deliberate pacing shifts — slowing down for \
                    emphasis on key achievements, slightly accelerating through context-setting. \
                    Consistency doesn't mean monotone speed; it means intentional control.".to_string(),
                weight: 0.15,
                metrics: vec!["wpm".into(), "wpm_variance".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Dynamics".to_string(),
                description: "Assess pitch and volume variation. A monotone delivery (flat pitch, \
                    uniform volume) puts interviewers to sleep regardless of content quality. \
                    Look for natural pitch variation that emphasizes key points, appropriate \
                    volume shifts (slightly louder for confident assertions, measured for \
                    thoughtful reflection). The goal is dynamic delivery that keeps the \
                    interviewer engaged, not theatrical performance.".to_string(),
                weight: 0.15,
                metrics: vec!["pitch_range".into(), "volume_variance".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
        ],
    }
}

fn dating_rubric(scenario_id: &str) -> Rubric {
    Rubric {
        mode: scenario_id.to_string(),
        focus: RubricFocus::Conversation,
        categories: vec![
            RubricCategory {
                name: "Engagement".to_string(),
                description: "Evaluate whether the user was genuinely engaged in the conversation \
                    as a potential romantic partner, not an interviewer. Strong engagement means \
                    asking thoughtful follow-up questions that show genuine curiosity about the \
                    other person, building on what they said rather than just pivoting to new \
                    topics, and sharing relevant personal details that create connection. Penalize \
                    rapid-fire question asking (feels like an interrogation), one-word responses, \
                    or making the conversation entirely about themselves.".to_string(),
                weight: 0.30,
                metrics: vec!["response_relevance".into(), "question_asking".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Humor & Wit".to_string(),
                description: "Score based on whether humor was natural, well-timed, and \
                    appropriate for a casual romantic context. Reward playful teasing, callback \
                    humor (referencing something said earlier), self-deprecating wit that shows \
                    confidence, and situational observations that make the moment feel light. \
                    Penalize try-hard jokes that fall flat, crude or overly sexual humor too \
                    early, sarcasm that comes across as mean-spirited, or zero humor at all \
                    (makes the date feel like a job interview). The bar is 'would a real person \
                    on a date laugh or smile at this?'".to_string(),
                weight: 0.20,
                metrics: vec!["humor_detection".into(), "conversation_flow".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Flow".to_string(),
                description: "Assess the natural rhythm of the conversation. Good flow means \
                    smooth topic transitions that feel organic (not jarring pivots), balanced \
                    turn-taking (not dominating or being too passive), and building threads \
                    that go deeper rather than staying surface-level. Penalize monologuing, \
                    awkward silences caused by not knowing what to say next, or constantly \
                    redirecting to safe/boring topics. A great date conversation has momentum — \
                    it feels like it could go on for hours.".to_string(),
                weight: 0.25,
                metrics: vec!["turn_length_balance".into(), "topic_transitions".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Confidence".to_string(),
                description: "Evaluate vocal delivery in a romantic context. Confidence on a \
                    date sounds different than in an interview — it's relaxed authority, not \
                    corporate assertiveness. Look for a grounded, unhurried pace, warm resonant \
                    tone, and downward inflections that signal comfort. Penalize nervous rushing, \
                    voice going higher pitched (signals anxiety/people-pleasing), trailing off \
                    at the end of sentences, or a flat monotone that signals boredom or \
                    disengagement. The gold standard: they sound like someone who is genuinely \
                    enjoying themselves and comfortable in their own skin.".to_string(),
                weight: 0.25,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
        ],
    }
}

fn dojo_rubric(scenario_id: &str) -> Rubric {
    Rubric {
        mode: scenario_id.to_string(),
        focus: RubricFocus::Vocal,
        categories: vec![
            RubricCategory {
                name: "Pitch Range".to_string(),
                description: "Measure the Hz distance between the lowest and highest pitch \
                    used during the session. A healthy conversational pitch range is 40-80Hz. \
                    Dynamic speakers often exceed 100Hz range. Penalize flat, monotone delivery \
                    (range <30Hz) where the user stays locked in one register. Reward deliberate \
                    use of highs and lows to create vocal contrast. Reference the pitch analytics \
                    data directly — this is a physics measurement, not a subjective judgment.".to_string(),
                weight: 0.30,
                metrics: vec!["pitch_range".into(), "pitch_variance".into()],
                thresholds: Thresholds { excellent: 85, good: 65, needs_work: 40 },
            },
            RubricCategory {
                name: "Inflection Control".to_string(),
                description: "Assess whether the user demonstrates intentional control over \
                    upward vs. downward pitch inflections. Downward inflection at sentence endings \
                    signals authority and completeness. Upward inflection (uptalk) on statements \
                    signals uncertainty. Score based on the ratio of intentional downward \
                    inflections on declarative statements. For training drills, check if they \
                    executed the specific technique being practiced (e.g. driving pitch down \
                    on command phrases).".to_string(),
                weight: 0.30,
                metrics: vec!["inflection_direction".into(), "inflection_consistency".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 35 },
            },
            RubricCategory {
                name: "Volume Dynamics".to_string(),
                description: "Evaluate volume variation and control. Strong vocal delivery uses \
                    volume as a tool — louder for emphasis, quieter for drawing attention in. \
                    Penalize consistent low volume (sounds timid), consistent high volume (sounds \
                    aggressive/uncontrolled), or zero variation (flat energy). Reference the \
                    volume analytics tags directly. The goal is demonstrating dynamic range, \
                    not just being loud.".to_string(),
                weight: 0.20,
                metrics: vec!["volume".into(), "volume_variance".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
            RubricCategory {
                name: "Pace Control".to_string(),
                description: "Evaluate WPM control and intentional pacing shifts. For vocal \
                    training, the goal is demonstrating the ability to shift pace deliberately — \
                    slowing down for emphasis, speeding up for energy. Penalize consistently \
                    rushed speech (>180 WPM, signals anxiety), consistently slow speech (<90 WPM, \
                    signals low energy), or zero variation. Reward clear pace shifts that align \
                    with the content being delivered.".to_string(),
                weight: 0.20,
                metrics: vec!["wpm".into(), "wpm_variance".into()],
                thresholds: Thresholds { excellent: 85, good: 65, needs_work: 45 },
            },
        ],
    }
}

fn star_rubric() -> Rubric {
    Rubric {
        mode: "star_interview_training".to_string(),
        focus: RubricFocus::Conversation,
        categories: vec![
            RubricCategory {
                name: "Structure Adherence".to_string(),
                description: "Evaluate strict compliance with the STAR format: Situation (1-2 \
                    sentences of context), Task (the specific goal or problem), Action (what \
                    THEY personally did, using 'I' not 'we'), Result (quantifiable outcome or \
                    clear resolution). Penalize: burying the lead in a long setup, skipping the \
                    Task entirely, using 'we' instead of 'I' in the Action (hiding behind the \
                    team), or ending without a concrete Result. The structure should be obvious \
                    to a listener without them needing to mentally reorganize the story.".to_string(),
                weight: 0.35,
                metrics: vec!["star_format_compliance".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Specificity".to_string(),
                description: "Assess the level of concrete detail in the response. Vague answers \
                    like 'I improved the process' fail. Strong answers include specific numbers, \
                    technologies, team sizes, timelines, and measurable outcomes ('reduced deploy \
                    time from 45 minutes to 8 minutes'). Penalize generic platitudes, buzzword \
                    stuffing, and answers that could apply to any candidate at any company. \
                    Reward unique, memorable details that prove the candidate actually did the \
                    work.".to_string(),
                weight: 0.30,
                metrics: vec!["detail_level".into(), "quantification".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Result Articulation".to_string(),
                description: "Specifically evaluate the quality of the Result portion. Did they \
                    quantify the impact (revenue, time saved, user growth)? Did they connect the \
                    result back to the business goal? Penalize soft endings ('it went well', \
                    'everyone was happy') and reward hard metrics, lessons learned, or \
                    architectural decisions that are still in production. The Result is what \
                    the interviewer remembers — it must land with authority.".to_string(),
                weight: 0.20,
                metrics: vec!["outcome_clarity".into(), "impact_statement".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Delivery".to_string(),
                description: "Assess vocal performance during STAR responses. Even perfect \
                    structure fails if delivered with a shaky voice, filler words, or monotone \
                    energy. Look for confident pacing (not rushing through the Action), pitch \
                    emphasis on key results, and clear articulation. Penalize trailing off at \
                    the end of the Result (signals the candidate doesn't believe their own \
                    impact) and excessive fillers during the Action section.".to_string(),
                weight: 0.15,
                metrics: vec!["pitch_range".into(), "pace".into(), "clarity_score".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
        ],
    }
}

fn speaking_intelligence_rubric() -> Rubric {
    Rubric {
        mode: "speaking_intelligence_training".to_string(),
        focus: RubricFocus::Both,
        categories: vec![
            RubricCategory {
                name: "Articulation".to_string(),
                description: "Evaluate physical speech clarity — are words crisp and fully \
                    formed, or mumbled and swallowed? This is about diction, not vocabulary. \
                    Check Deepgram confidence scores: high confidence = clear speech, low \
                    confidence = mumbled. Penalize dropped consonants, lazy vowels, and words \
                    that blend together into mush. Reward precise enunciation that sounds natural, \
                    not robotic.".to_string(),
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "mumble_ratio".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Vocal Authority".to_string(),
                description: "Assess whether the user sounds like someone worth listening to. \
                    Vocal authority comes from chest resonance (not nasal or throaty), downward \
                    inflections on statements, appropriate volume (not meek), and deliberate \
                    pacing. Penalize uptalk on declarative statements, vocal fry, whispery \
                    delivery, and speaking too fast (rushing signals deference). Reward a \
                    grounded, commanding tone that doesn't need to yell to fill a room.".to_string(),
                weight: 0.25,
                metrics: vec!["pitch_range".into(), "volume".into(), "downward_inflection".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Pacing Mastery".to_string(),
                description: "Evaluate strategic use of pace. Intelligent speakers use pace as \
                    a rhetorical tool — faster for building momentum and energy, dramatically \
                    slower for key points and conclusions. The power pause (2-3 seconds of \
                    deliberate silence before a key statement) is the hallmark of a master. \
                    Penalize a constant metronome pace and rushing through conclusions. \
                    Reward clear evidence of intentional speed shifts.".to_string(),
                weight: 0.25,
                metrics: vec!["wpm".into(), "pause_usage".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Filler Elimination".to_string(),
                description: "Strict evaluation of filler word usage. In this training module, \
                    fillers are the primary enemy. Count every 'um', 'uh', 'like', 'you know', \
                    'basically', 'sort of', 'kind of', and 'I mean' as a failure point. Zero \
                    fillers in a response is the target. 1-2 in a long response is acceptable. \
                    3+ is a clear fail. Each filler should be called out by the evaluator with \
                    the specific word and its position in the transcript.".to_string(),
                weight: 0.20,
                metrics: vec!["filler_count".into()],
                thresholds: Thresholds { excellent: 95, good: 80, needs_work: 60 },
            },
        ],
    }
}

fn masculine_frame_rubric() -> Rubric {
    Rubric {
        mode: "masculine_frame_training".to_string(),
        focus: RubricFocus::Both,
        categories: vec![
            RubricCategory {
                name: "Frame Control".to_string(),
                description: "Evaluate whether the user maintained psychological frame under \
                    social pressure. Frame control means not getting defensive when tested, not \
                    over-explaining or justifying yourself, and steering the conversation's \
                    emotional direction. Penalize: logical defensiveness to a social test \
                    ('Actually, I'm not like that...'), seeking validation ('Does that make \
                    sense?'), and letting the other person dictate the emotional tone. Reward: \
                    agree-and-amplify responses, playful reframes, and maintaining composure \
                    when challenged.".to_string(),
                weight: 0.30,
                metrics: vec!["topic_control".into(), "conversation_leadership".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Presence".to_string(),
                description: "Assess the 'Amused Mastery' vocal signature — a grounded, \
                    unhurried, slightly playful tone that signals the speaker cannot be rattled. \
                    Look for: slow deliberate pace (not rushing to fill silence), deep chest \
                    resonance, downward inflections, and calm emotional tone even during tense \
                    moments. Penalize: voice going higher pitched under pressure (anxiety tells), \
                    rushing words (signals need for approval), and flat monotone (signals \
                    checked-out, not unbothered). Reference Hume prosody data if available — \
                    spikes in anxiety or fear during social tests are vocal frame breaks.".to_string(),
                weight: 0.30,
                metrics: vec!["pitch_range".into(), "volume".into(), "downward_inflection".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Depth".to_string(),
                description: "Evaluate the quality of engagement beyond surface-level banter. \
                    Frame-controlled men lead conversations into deeper territory — sharing \
                    genuine perspectives, asking questions that reveal character, and creating \
                    moments of authentic connection. Penalize: staying entirely on safe/generic \
                    topics, failing to share any vulnerability (overcompensating with pure \
                    bravado), and interview-style question bombardment. Reward: balance of \
                    playfulness with substance, active listening cues, and building on what \
                    the other person shares.".to_string(),
                weight: 0.20,
                metrics: vec!["response_depth".into(), "active_listening".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Pacing & Pauses".to_string(),
                description: "Evaluate the strategic use of silence and pace in social dynamics. \
                    High-status communicators are comfortable with silence — they don't rush to \
                    fill every gap. Look for: deliberate pauses before responding to tests (the \
                    '3-second smirk'), unhurried delivery, and pace that signals 'I'm not in a \
                    hurry to impress you.' Penalize: machine-gun responses (answering instantly \
                    to every test), rushed speech, and nervous verbal tics. Reward: comfortable \
                    silence, measured responses, and pace shifts that create tension \
                    intentionally.".to_string(),
                weight: 0.20,
                metrics: vec!["wpm".into(), "pause_usage".into(), "rushed_speech".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
        ],
    }
}

fn playground_rubric() -> Rubric {
    Rubric {
        mode: "playground_training".to_string(),
        focus: RubricFocus::Vocal,
        categories: vec![
            RubricCategory {
                name: "Overall Vocal Performance".to_string(),
                description: "Holistic assessment of vocal delivery across all dimensions. \
                    This is the playground — there's no specific scenario, so evaluate general \
                    vocal quality: Is the speaker engaging to listen to? Do they use their \
                    full vocal range? Is their pace varied and intentional? Would you want to \
                    keep listening to them? Score as an overall 'watchability' or 'listenability' \
                    metric based on the combined pitch, volume, and pace data.".to_string(),
                weight: 0.40,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
            RubricCategory {
                name: "Clarity".to_string(),
                description: "Evaluate speech clarity using Deepgram confidence scores as the \
                    primary data source. Are words cleanly articulated? Can every word be \
                    clearly understood? Penalize mumbled sequences (multiple consecutive low-\
                    confidence words), swallowed endings, and lazy articulation. This is a \
                    physics measurement — rely on the data, not subjective impression.".to_string(),
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "mumble_ratio".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Expressiveness".to_string(),
                description: "Assess vocal expressiveness — the opposite of monotone delivery. \
                    Look for pitch variation that matches emotional content, volume shifts that \
                    create contrast, and inflection patterns that keep the listener's attention. \
                    In the playground, there's no 'right' emotion — the goal is simply to \
                    demonstrate dynamic range. A flat, robotic delivery scores low regardless \
                    of content quality.".to_string(),
                weight: 0.30,
                metrics: vec!["pitch_variance".into(), "volume_variance".into(), "inflection_variety".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
        ],
    }
}

fn default_rubric(scenario_id: &str) -> Rubric {
    Rubric {
        mode: scenario_id.to_string(),
        focus: RubricFocus::Both,
        categories: vec![
            RubricCategory {
                name: "Communication Clarity".to_string(),
                description: "Evaluate overall clarity of communication — both what was said \
                    and how clearly it was articulated. Are ideas expressed logically? Is speech \
                    physically clear (no mumbling)? Can a listener follow the thread without \
                    effort? This is a general-purpose clarity metric for scenarios without \
                    specific rubrics.".to_string(),
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "wpm".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Delivery".to_string(),
                description: "General assessment of vocal quality: pitch variation, volume \
                    control, and pacing. Is the speaker engaging to listen to, or flat and \
                    monotone? Do they use their vocal range intentionally? This is a catch-all \
                    vocal metric that applies regardless of scenario context.".to_string(),
                weight: 0.35,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Quality".to_string(),
                description: "Evaluate the quality of conversational engagement. Was the user \
                    an active participant? Did they listen and respond relevantly? Did they \
                    contribute substance to the conversation? Penalize disengagement, off-topic \
                    rambling, and surface-level responses that don't build the interaction.".to_string(),
                weight: 0.35,
                metrics: vec!["engagement".into(), "response_quality".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
        ],
    }
}
