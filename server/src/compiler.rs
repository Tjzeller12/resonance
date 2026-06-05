use axum::{extract::Json, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

use crate::gemini::{GeminiClient, GeminiError};

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

// ─── Handler ────────────────────────────────────────────────────────────────

pub async fn compile_handler(Json(payload): Json<CompileRequest>) -> impl IntoResponse {
    info!(
        "[Compiler] Received compile request with {} inputs",
        payload.inputs.len()
    );

    // Build the full prompt: compilation instructions + user inputs
    let mut full_prompt = payload.compilation_prompt.clone();
    full_prompt.push_str("\n\n--- USER INPUTS ---\n");
    for (key, value) in &payload.inputs {
        full_prompt.push_str(&format!("\n### {}\n{}\n", key.to_uppercase(), value));
    }
    full_prompt.push_str("\n--- END USER INPUTS ---\n\nReturn ONLY valid JSON matching this schema: { \"summary\": \"<200 char overview>\", \"stages\": [{ \"id\": \"stage_1\", \"title\": \"<stage name>\", \"prompt\": \"<detailed system prompt based on instructions>\", \"duration_hint\": \"<e.g. 2-3 questions>\" }] }");

    info!("[Compiler] Sending to Gemini ({} chars)", full_prompt.len());

    // Use the unified Gemini client
    let result = async {
        GeminiClient::builder()
            .model("gemini-2.5-flash")
            .temperature(0.3)
            .json_response()
            .build_rest()?
            .generate::<CompiledSimulation>(&full_prompt)
            .await
    }
    .await;

    match result {
        Ok(compiled) => {
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
        Err(e) => {
            let status = match &e {
                GeminiError::ApiKeyMissing => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiError::RequestFailed(_) => StatusCode::BAD_GATEWAY,
                GeminiError::ApiError { .. } => StatusCode::BAD_GATEWAY,
                GeminiError::InvalidResponse(_) => StatusCode::INTERNAL_SERVER_ERROR,
                GeminiError::ParseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };

            (
                status,
                Json(CompileResponse {
                    success: false,
                    data: None,
                    error: Some(e.to_string()),
                }),
            )
        }
    }
}
