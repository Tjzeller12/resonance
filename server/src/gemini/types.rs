use serde::{Deserialize, Serialize};
use std::fmt;

// ─── Error Type ─────────────────────────────────────────────────────────────

/// Unified error type for all Gemini API interactions.
#[derive(Debug)]
pub enum GeminiError {
    /// GEMINI_API_KEY environment variable is not set.
    ApiKeyMissing,
    /// The HTTP request or WebSocket connection failed at the transport level.
    RequestFailed(String),
    /// Gemini returned a non-2xx status code.
    ApiError { status: u16, body: String },
    /// The response body couldn't be deserialized into the expected shape.
    InvalidResponse(String),
    /// The structured JSON output from Gemini couldn't be parsed into the target type.
    ParseError(String),
}

impl fmt::Display for GeminiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GeminiError::ApiKeyMissing => write!(f, "GEMINI_API_KEY not configured"),
            GeminiError::RequestFailed(msg) => write!(f, "Request failed: {}", msg),
            GeminiError::ApiError { status, body } => {
                write!(f, "Gemini API error {}: {}", status, body)
            }
            GeminiError::InvalidResponse(msg) => write!(f, "Invalid response: {}", msg),
            GeminiError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for GeminiError {}

// ─── REST API Types ─────────────────────────────────────────────────────────

/// Top-level request body for the generateContent REST endpoint.
#[derive(Serialize)]
pub struct RestRequest {
    pub contents: Vec<Content>,
    #[serde(rename = "generationConfig")]
    pub generation_config: GenerationConfig,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<Content>,
}

/// A single content block (user message, system instruction, etc.)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Content {
    pub parts: Vec<Part>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}

/// A single part within a content block (text, inline data, etc.)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Part {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

/// Generation parameters sent alongside the request.
#[derive(Serialize)]
pub struct GenerationConfig {
    #[serde(rename = "responseMimeType", skip_serializing_if = "Option::is_none")]
    pub response_mime_type: Option<String>,
    pub temperature: f32,
    #[serde(rename = "responseModalities", skip_serializing_if = "Option::is_none")]
    pub response_modalities: Option<Vec<String>>,
}

/// Top-level response from generateContent.
#[derive(Deserialize)]
pub struct RestResponse {
    pub candidates: Option<Vec<Candidate>>,
}

/// A single candidate in the response.
#[derive(Deserialize)]
pub struct Candidate {
    pub content: CandidateContent,
}

/// The content block within a candidate.
#[derive(Deserialize)]
pub struct CandidateContent {
    pub parts: Vec<ResponsePart>,
}

/// A single part in a candidate's content.
#[derive(Deserialize)]
pub struct ResponsePart {
    pub text: Option<String>,
}

// ─── WebSocket (Live) API Types ─────────────────────────────────────────────

/// Represents the two types of data Gemini can stream back over WebSocket.
pub enum GeminiEvent {
    /// Raw Base64-decoded audio chunks (PCM) representing the bot's synthesized voice.
    Audio(Vec<u8>),
    /// Live transcript portions of what the bot is actively saying.
    Text(String),
}
