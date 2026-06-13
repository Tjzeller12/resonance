use axum::{extract::Json, http::StatusCode};
use serde::Serialize;

use crate::gemini::GeminiError;

/// Standard JSON envelope returned by all REST endpoints.
#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> (StatusCode, Json<Self>) {
        (
            StatusCode::OK,
            Json(Self {
                success: true,
                data: Some(data),
                error: None,
            }),
        )
    }

    pub fn from_gemini_error(e: &GeminiError) -> (StatusCode, Json<Self>) {
        (
            status_for(e),
            Json(Self {
                success: false,
                data: None,
                error: Some(e.to_string()),
            }),
        )
    }
}

/// Maps a Gemini client error to the HTTP status the endpoint should return.
/// Upstream/transport failures are 502; everything else is our fault (500).
fn status_for(e: &GeminiError) -> StatusCode {
    match e {
        GeminiError::RequestFailed(_) | GeminiError::ApiError { .. } => StatusCode::BAD_GATEWAY,
        GeminiError::ApiKeyMissing
        | GeminiError::InvalidResponse(_)
        | GeminiError::ParseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}
