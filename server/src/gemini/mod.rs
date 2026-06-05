//! Unified Gemini API client supporting both REST and WebSocket transports.
//!
//! # Usage
//!
//! ```ignore
//! use crate::gemini::GeminiClient;
//!
//! // REST (one-shot)
//! let result = GeminiClient::builder()
//!     .model("gemini-2.5-flash")
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

mod client;
mod types;

// Re-export the public API
pub use client::{
    GeminiClient, GeminiClientBuilder, GeminiLiveClient, GeminiRestClient, GeminiStream,
    parse_live_event,
};
pub use types::{GeminiError, GeminiEvent};
