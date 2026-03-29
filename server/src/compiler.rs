use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

// ─── Request / Response types ───────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CompileRequest {
    /// Raw text inputs from the user (e.g. { "resume": "...", "job_description": "..." })
    pub inputs: HashMap<String, String>,
    /// The prompt template that tells Gemini how to compile the inputs into stages
    pub compilation_prompt: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SimulationStage {
    pub id: String,
    pub title: String,
    /// The system prompt for this stage (≤1800 chars)
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_hint: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CompiledSimulation {
    pub summary: String,
    pub stages: Vec<SimulationStage>,
}

#[derive(Serialize)]
pub struct CompileResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<CompiledSimulation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ─── Gemini REST API types ──────────────────────────────────────────────────

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    generation_config: GeminiGenerationConfig,
}

#[derive(Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiGenerationConfig {
    response_mime_type: String,
    temperature: f32,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
}

#[derive(Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
}

// ─── Handler ────────────────────────────────────────────────────────────────

const GEMINI_REST_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";

pub async fn compile_handler(Json(payload): Json<CompileRequest>) -> impl IntoResponse {
    info!("[Compiler] Received compile request with {} inputs", payload.inputs.len());

    let api_key = match std::env::var("GEMINI_API_KEY") {
        Ok(key) => key,
        Err(_) => {
            warn!("[Compiler] GEMINI_API_KEY not set");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some("GEMINI_API_KEY not configured".to_string()),
                }),
            );
        }
    };

    // Build the full prompt: compilation instructions + user inputs
    let mut full_prompt = payload.compilation_prompt.clone();
    full_prompt.push_str("\n\n--- USER INPUTS ---\n");
    for (key, value) in &payload.inputs {
        full_prompt.push_str(&format!("\n### {}\n{}\n", key.to_uppercase(), value));
    }
    full_prompt.push_str("\n--- END USER INPUTS ---\n\nReturn ONLY valid JSON matching this schema: { \"summary\": \"<200 char overview>\", \"stages\": [{ \"id\": \"stage_1\", \"title\": \"<stage name>\", \"prompt\": \"<system prompt, max 1800 chars>\", \"duration_hint\": \"<e.g. 2-3 questions>\" }] }");

    info!("[Compiler] Sending to Gemini ({} chars)", full_prompt.len());

    // Call Gemini REST API
    let client = reqwest::Client::new();
    let gemini_request = GeminiRequest {
        contents: vec![GeminiContent {
            parts: vec![GeminiPart { text: full_prompt }],
        }],
        generation_config: GeminiGenerationConfig {
            response_mime_type: "application/json".to_string(),
            temperature: 0.3,
        },
    };

    let url = format!("{}?key={}", GEMINI_REST_URL, api_key);

    let response = match client.post(&url).json(&gemini_request).send().await {
        Ok(resp) => resp,
        Err(e) => {
            warn!("[Compiler] Gemini request failed: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to reach Gemini: {}", e)),
                }),
            );
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        warn!("[Compiler] Gemini returned {}: {}", status, body);
        return (
            StatusCode::BAD_GATEWAY,
            Json(CompileResponse {
                success: false,
                data: None,
                error: Some(format!("Gemini API error {}: {}", status, body)),
            }),
        );
    }

    let gemini_resp: GeminiResponse = match response.json().await {
        Ok(r) => r,
        Err(e) => {
            warn!("[Compiler] Failed to parse Gemini response: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to parse Gemini response: {}", e)),
                }),
            );
        }
    };

    // Extract the JSON text from Gemini's response
    let raw_json = match gemini_resp
        .candidates
        .as_ref()
        .and_then(|c| c.first())
        .and_then(|c| c.content.parts.first())
        .and_then(|p| p.text.as_ref())
    {
        Some(text) => text.clone(),
        None => {
            warn!("[Compiler] No text in Gemini response");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some("Empty response from Gemini".to_string()),
                }),
            );
        }
    };

    info!("[Compiler] Got Gemini response ({} chars), parsing...", raw_json.len());

    // Parse the structured JSON response
    let compiled: CompiledSimulation = match serde_json::from_str(&raw_json) {
        Ok(c) => c,
        Err(e) => {
            warn!("[Compiler] Failed to parse compiled stages: {}. Raw: {}", e, &raw_json[..raw_json.len().min(500)]);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to parse stages: {}. Check compilation prompt.", e)),
                }),
            );
        }
    };

    info!(
        "[Compiler] ✅ Compiled {} stages. Summary: {}",
        compiled.stages.len(),
        &compiled.summary[..compiled.summary.len().min(100)]
    );

    (
        StatusCode::OK,
        Json(CompileResponse {
            success: true,
            data: Some(compiled),
            error: None,
        }),
    )
}
