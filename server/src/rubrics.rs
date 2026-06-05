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
                weight: 0.25,
                metrics: vec!["transcript_coherence".into(), "response_length".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Confidence Projection".to_string(),
                weight: 0.25,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Filler Word Avoidance".to_string(),
                weight: 0.20,
                metrics: vec!["filler_count".into(), "clarity_score".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Pacing Consistency".to_string(),
                weight: 0.15,
                metrics: vec!["wpm".into(), "wpm_variance".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Dynamics".to_string(),
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
                weight: 0.30,
                metrics: vec!["response_relevance".into(), "question_asking".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Humor & Wit".to_string(),
                weight: 0.20,
                metrics: vec!["humor_detection".into(), "conversation_flow".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Flow".to_string(),
                weight: 0.25,
                metrics: vec!["turn_length_balance".into(), "topic_transitions".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Confidence".to_string(),
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
                weight: 0.30,
                metrics: vec!["pitch_range".into(), "pitch_variance".into()],
                thresholds: Thresholds { excellent: 85, good: 65, needs_work: 40 },
            },
            RubricCategory {
                name: "Inflection Control".to_string(),
                weight: 0.30,
                metrics: vec!["inflection_direction".into(), "inflection_consistency".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 35 },
            },
            RubricCategory {
                name: "Volume Dynamics".to_string(),
                weight: 0.20,
                metrics: vec!["volume".into(), "volume_variance".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
            RubricCategory {
                name: "Pace Control".to_string(),
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
                weight: 0.35,
                metrics: vec!["star_format_compliance".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Specificity".to_string(),
                weight: 0.30,
                metrics: vec!["detail_level".into(), "quantification".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Result Articulation".to_string(),
                weight: 0.20,
                metrics: vec!["outcome_clarity".into(), "impact_statement".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Delivery".to_string(),
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
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "mumble_ratio".into()],
                thresholds: Thresholds { excellent: 90, good: 75, needs_work: 55 },
            },
            RubricCategory {
                name: "Vocal Authority".to_string(),
                weight: 0.25,
                metrics: vec!["pitch_range".into(), "volume".into(), "downward_inflection".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Pacing Mastery".to_string(),
                weight: 0.25,
                metrics: vec!["wpm".into(), "pause_usage".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Filler Elimination".to_string(),
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
                weight: 0.30,
                metrics: vec!["topic_control".into(), "conversation_leadership".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Presence".to_string(),
                weight: 0.30,
                metrics: vec!["pitch_range".into(), "volume".into(), "downward_inflection".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Depth".to_string(),
                weight: 0.20,
                metrics: vec!["response_depth".into(), "active_listening".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Pacing & Pauses".to_string(),
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
                weight: 0.40,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 60, needs_work: 40 },
            },
            RubricCategory {
                name: "Clarity".to_string(),
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "mumble_ratio".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Expressiveness".to_string(),
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
                weight: 0.30,
                metrics: vec!["clarity_score".into(), "wpm".into()],
                thresholds: Thresholds { excellent: 85, good: 70, needs_work: 50 },
            },
            RubricCategory {
                name: "Vocal Delivery".to_string(),
                weight: 0.35,
                metrics: vec!["pitch_range".into(), "volume".into(), "pace".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
            RubricCategory {
                name: "Conversational Quality".to_string(),
                weight: 0.35,
                metrics: vec!["engagement".into(), "response_quality".into()],
                thresholds: Thresholds { excellent: 80, good: 65, needs_work: 45 },
            },
        ],
    }
}
