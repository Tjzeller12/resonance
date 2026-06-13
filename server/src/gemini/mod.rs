//! Unified Gemini API client supporting both REST and WebSocket transports.
//!
//! # Usage
//!
//! ```ignore
//! use crate::gemini::GeminiClient;
//!
//! // REST (one-shot)
//! let result = GeminiClient::builder()
//!     .model("gemini-3.5-flash")
//!     .json_response()
//!     .temperature(0.3)
//!     .build_rest()?
//!     .generate::<MyStruct>(&prompt)
//!     .await?;
//!
//! // Live (WebSocket streaming)
//! let stream = GeminiClient::builder()
//!     .model("gemini-2.5-flash-native-audio")
//!     .system_instruction("You are a coach.")
//!     .response_modalities(vec!["audio".into()])
//!     .build_live()?
//!     .connect()
//!     .await?;
//! ```

/// Model identifiers used across the app. Centralized so a model upgrade
/// is a one-line change instead of a grep across handlers.
pub mod models {
    /// Fast model for pre-flight compilation of simulation stages.
    pub const FLASH: &str = "gemini-3.5-flash";
    /// High-quality model for post-match conversation analysis.
    pub const PRO: &str = "gemini-2.5-pro";
    /// Live (WebSocket) model for real-time vocal tagging.
    pub const FLASH_LIVE: &str = "gemini-3.1-flash-live-preview";
}

mod client;
mod types;

// Re-export the public API
pub use client::{parse_live_event, GeminiClient, GeminiLiveClient, GeminiStream};
pub use types::{GeminiError, GeminiEvent};
