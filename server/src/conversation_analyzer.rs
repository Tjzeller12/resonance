use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::gemini::{GeminiClient, GeminiError};
use crate::rubrics;

// ─── Request Types ──────────────────────────────────────────────────────────

/// The full conversation payload sent by the client after a session ends.
#[derive(Deserialize, Debug)]
pub struct AnalyzeRequest {
    /// Unique session identifier
    pub session_id: String,
    /// Scenario that was played (e.g. "tech_interview", "bar", "dojo_inflection")
    pub scenario_id: String,
    /// Session mode
    pub mode: SessionMode,
    /// Unix ms timestamp when the session started
    pub started_at: u64,
    /// Unix ms timestamp when the session ended
    pub ended_at: u64,
    /// Full conversation transcript from Hume EVI (user + AI messages)
    pub hume_transcript: Vec<HumeMessage>,
    /// Per-sentence analytics traces from the Deepgram + sensor fusion engine
    pub deepgram_analytics: Vec<SentenceAnalytics>,
    /// Aggregated sensor data summary
    pub sensor_summary: SensorSummary,
    /// Stage progression timeline (for staged simulations)
    #[serde(default)]
    pub stage_progression: Vec<StageEntry>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SessionMode {
    EviSim,
    Training,
    Dojo,
}

/// A single message from the Hume EVI conversation.
#[derive(Deserialize, Serialize, Debug)]
pub struct HumeMessage {
    /// "user" or "assistant"
    pub role: String,
    /// The spoken text content
    pub content: String,
    /// Unix ms timestamp
    pub timestamp: u64,
    /// Top prosody/emotion scores from Hume (if available)
    #[serde(default)]
    pub prosody: Option<ProsodyScores>,
}

/// Top emotion scores from Hume's prosody analysis.
#[derive(Deserialize, Serialize, Debug)]
pub struct ProsodyScores {
    #[serde(default)]
    pub top_emotions: Vec<EmotionScore>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct EmotionScore {
    pub name: String,
    pub score: f64,
}

/// Per-sentence analytics from the voice analytics engine.
#[derive(Deserialize, Serialize, Debug)]
pub struct SentenceAnalytics {
    /// Unix ms timestamp
    pub timestamp: u64,
    /// The sentence text
    pub transcript: String,
    /// Generated tags (e.g. "Downward inflection", "Pace is fast (165 WPM)")
    pub tags: Vec<String>,
    /// Per-word pitch/volume mapping
    pub word_metrics: Vec<WordMetrics>,
    /// Aggregated debug data
    pub debug: SentenceDebug,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct WordMetrics {
    pub word: String,
    pub confidence: f64,
    pub avg_pitch: f64,
    pub avg_volume: f64,
    pub start: f64,
    pub end: f64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct SentenceDebug {
    pub true_wpm: u32,
    pub word_count: u32,
    pub avg_pitch: f64,
    pub pitch_range: f64,
    pub avg_volume: f64,
    pub clarity_score: f64,
    #[serde(default)]
    pub mumbled_words: Vec<MumbledWord>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct MumbledWord {
    pub word: String,
    pub confidence: f64,
}

/// Aggregated sensor statistics for the full session.
#[derive(Deserialize, Serialize, Debug)]
pub struct SensorSummary {
    pub avg_pitch: f64,
    pub avg_volume: f64,
    pub total_duration_ms: u64,
}

/// A stage entry in the progression timeline.
#[derive(Deserialize, Serialize, Debug)]
pub struct StageEntry {
    pub stage_id: String,
    pub title: String,
    pub started_at: u64,
    #[serde(default)]
    pub ended_at: Option<u64>,
}

// ─── Response Types ─────────────────────────────────────────────────────────

/// The structured analysis returned to the client.
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct AnalysisResult {
    /// Per-category scores with justifications
    #[serde(default)]
    pub category_scores: Vec<CategoryScore>,
    /// Weighted total XP earned
    #[serde(default)]
    pub total_xp: u32,
    /// Best and worst moments from the session
    #[serde(default)]
    pub highlights: Vec<Highlight>,
    /// Recommended next training modules
    #[serde(default)]
    pub suggested_training: Vec<SuggestedTraining>,
    /// Narrative summary of performance
    #[serde(default)]
    pub overall_feedback: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CategoryScore {
    /// Category name (matches rubric category name)
    pub category: String,
    /// Score 0-100
    pub score: u32,
    /// Weight from the rubric (0.0 - 1.0)
    pub weight: f32,
    /// LLM-generated justification for the score
    pub justification: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Highlight {
    /// "strength" or "weakness"
    pub highlight_type: String,
    /// The moment's transcript snippet
    pub transcript_snippet: String,
    /// Unix ms timestamp of the moment
    #[serde(default)]
    pub timestamp: u64,
    /// Why this moment was notable
    pub explanation: String,
    /// Optional suggestion for improvement (e.g. what to say instead)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuggestedTraining {
    /// Scenario ID of the recommended module
    pub module_id: String,
    /// Human-readable module name
    pub module_name: String,
    /// Why this module is recommended
    pub reason: String,
}

/// Wrapper response for the analyze endpoint.
#[derive(Serialize)]
pub struct AnalyzeResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<AnalysisResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ─── Handler ────────────────────────────────────────────────────────────────

pub async fn analyze_handler(Json(payload): Json<AnalyzeRequest>) -> impl IntoResponse {
    info!(
        "[Analyzer] Received analysis request: session={}, scenario={}, {} messages, {} sentences",
        payload.session_id,
        payload.scenario_id,
        payload.hume_transcript.len(),
        payload.deepgram_analytics.len()
    );

    // 1. Look up the rubric for this scenario
    let rubric = rubrics::get_rubric(&payload.scenario_id);
    info!(
        "[Analyzer] Using rubric: {} ({} categories, focus={:?})",
        rubric.mode,
        rubric.categories.len(),
        rubric.focus
    );

    // 2. Build the LLM prompt
    let prompt = build_analysis_prompt(&payload, &rubric);
    info!("[Analyzer] Built prompt ({} chars)", prompt.len());

    // 3. Call Gemini
    let result = async {
        GeminiClient::builder()
            .model("gemini-2.5-pro")
            .temperature(0.4)
            .json_response()
            .system_instruction(ANALYSIS_SYSTEM_INSTRUCTION)
            .build_rest()?
            .generate::<AnalysisResult>(&prompt)
            .await
    }
    .await;

    match result {
        Ok(analysis) => {
            info!(
                "[Analyzer] ✅ Analysis complete: {} XP, {} highlights",
                analysis.total_xp,
                analysis.highlights.len()
            );
            (
                StatusCode::OK,
                Json(AnalyzeResponse {
                    success: true,
                    data: Some(analysis),
                    error: None,
                }),
            )
        }
        Err(e) => {
            warn!("[Analyzer] ❌ Analysis failed: {}", e);
            let status = match &e {
                GeminiError::ApiKeyMissing => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiError::RequestFailed(_) => StatusCode::BAD_GATEWAY,
                GeminiError::ApiError { .. } => StatusCode::BAD_GATEWAY,
                GeminiError::InvalidResponse(_) => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiError::ParseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };
            (
                status,
                Json(AnalyzeResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                }),
            )
        }
    }
}

// ─── Prompt Construction ────────────────────────────────────────────────────

const ANALYSIS_SYSTEM_INSTRUCTION: &str = r#"You are a vocal performance analysis engine for Resonance, a social skills training platform. You receive structured conversation data with vocal analytics and must produce precise, actionable scoring.

Your output MUST be valid JSON matching the AnalysisResult schema exactly. No markdown, no commentary outside the JSON.

Scoring rules:
- Scores are 0-100 per category. Be honest and calibrated — don't inflate scores.
- Use the provided rubric categories and weights exactly.
- total_xp = round(sum(category_score * weight * 100)) for each category.
- Justify every score with specific evidence from the transcript and analytics data.
- Highlights should reference actual moments from the conversation with timestamps ONLY in the designated JSON `timestamp` field.
- NEVER use raw timestamps (like `t=1780800754490ms`) in the text of your justifications, explanations, or overall feedback. Reference moments using natural language (e.g., "When you asked about...").
- For highlights (especially weaknesses), your `suggestion` MUST be a direct rewrite of the user's snippet. Give them the exact phrasing of what they should have said instead to improve the situation. Do NOT use emojis. Keep it professional.
- suggested_training should map to real module IDs from the platform."#;

fn build_analysis_prompt(
    payload: &AnalyzeRequest,
    rubric: &rubrics::Rubric,
) -> String {
    let rubric_json = serde_json::to_string_pretty(rubric).unwrap_or_default();

    // Build the conversation timeline by merging Hume transcript with analytics
    let mut conversation_section = String::new();
    for msg in &payload.hume_transcript {
        let role_label = if msg.role == "user" { "USER" } else { "AI" };
        conversation_section.push_str(&format!(
            "\n[{}] (t={}ms): {}\n",
            role_label, msg.timestamp, msg.content
        ));

        // For user messages, attach matching analytics data
        if msg.role == "user" {
            let matching_analytics: Vec<&SentenceAnalytics> = payload
                .deepgram_analytics
                .iter()
                .filter(|a| {
                    // Match analytics within a reasonable time window of the message
                    let diff = if a.timestamp > msg.timestamp {
                        a.timestamp - msg.timestamp
                    } else {
                        msg.timestamp - a.timestamp
                    };
                    diff < 30000 // Within 30 seconds
                })
                .collect();

            if !matching_analytics.is_empty() {
                conversation_section.push_str("  📊 Voice Analytics:\n");
                for analytics in matching_analytics {
                    conversation_section.push_str(&format!(
                        "    - Tags: [{}]\n    - WPM: {} | Pitch: {:.0}Hz (range: {:.0}Hz) | Volume: {:.2} | Clarity: {:.0}%\n",
                        analytics.tags.join(", "),
                        analytics.debug.true_wpm,
                        analytics.debug.avg_pitch,
                        analytics.debug.pitch_range,
                        analytics.debug.avg_volume,
                        analytics.debug.clarity_score * 100.0
                    ));
                    if !analytics.debug.mumbled_words.is_empty() {
                        let mumbled: Vec<String> = analytics
                            .debug
                            .mumbled_words
                            .iter()
                            .map(|w| format!("\"{}\" ({:.0}%)", w.word, w.confidence * 100.0))
                            .collect();
                        conversation_section.push_str(&format!(
                            "    - Mumbled words: {}\n",
                            mumbled.join(", ")
                        ));
                    }
                }
            }
        }
    }

    // Build stage progression section
    let stages_section = if payload.stage_progression.is_empty() {
        "No stage progression data (single-stage session).".to_string()
    } else {
        payload
            .stage_progression
            .iter()
            .map(|s| {
                let duration = s
                    .ended_at
                    .map(|end| format!("{}s", (end - s.started_at) / 1000))
                    .unwrap_or_else(|| "ongoing".to_string());
                format!("  - {} ({}): {}", s.stage_id, duration, s.title)
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let duration_s = (payload.ended_at - payload.started_at) / 1000;

    format!(
        r#"Analyze this conversation session and produce a structured scoring report.

=== SESSION METADATA ===
Session ID: {}
Scenario: {}
Mode: {:?}
Duration: {}s ({:.1} minutes)

=== GRADING RUBRIC ===
{}

=== STAGE PROGRESSION ===
{}

=== SENSOR SUMMARY ===
Average Pitch: {:.1} Hz
Average Volume: {:.3}
Total Duration: {}ms

=== FULL CONVERSATION WITH ANALYTICS ===
{}

=== AVAILABLE TRAINING MODULES ===
When recommending training, you MUST choose from the following valid module_ids:
- "downward_inflection_technique_training": Downward Inflection Training
- "pitch_variance_training": Pitch Variance Training
- "pace_and_volume_variance_training": Pace & Volume Training
- "speaking_intelligence_training": Speaking Intelligence
- "star_interview_training": STAR Method Training
- "masculine_frame_training": Masculine Frame Training
- "playground_training": Playground

=== OUTPUT FORMAT ===
Return a JSON object with this exact structure:
{{
  "category_scores": [
    {{ "category": "<rubric category name>", "score": <0-100>, "weight": <from rubric>, "justification": "<specific evidence>" }}
  ],
  "total_xp": <weighted sum>,
  "highlights": [
    {{ "highlight_type": "strength|weakness", "transcript_snippet": "<exact quote>", "timestamp": <unix_ms>, "explanation": "<why notable>", "suggestion": "<optional for strengths; required for weaknesses: direct rewrite of snippet providing exact phrasing of what they should have said instead. Do NOT use emojis.>" }}
  ],
  "suggested_training": [
    {{ "module_id": "<must be from AVAILABLE TRAINING MODULES list>", "module_name": "<display name>", "reason": "<specific weakness to address>" }}
  ],
  "overall_feedback": "<2-3 paragraph narrative summary>"
}}"#,
        payload.session_id,
        payload.scenario_id,
        payload.mode,
        duration_s,
        duration_s as f64 / 60.0,
        rubric_json,
        stages_section,
        payload.sensor_summary.avg_pitch,
        payload.sensor_summary.avg_volume,
        payload.sensor_summary.total_duration_ms,
        conversation_section,
    )
}
