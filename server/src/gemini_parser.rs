use serde_json::Value;
use base64::Engine;

/// A utility for tearing down deeply nested JSON responses from Google Gemini's websocket API.
pub struct GeminiParser;

/// Represents the two fundamentally different types of data Gemini can stream back to us.
pub enum GeminiEvent {
    /// Raw Base64 decoded audio chunks (PCM) representing the bot's synthesized voice.
    Audio(Vec<u8>),
    /// Live transcript portions of what the bot is actively saying.
    Text(String)
}

impl GeminiParser {
    /// Plucks the first valid piece of text or audio data from a complex Gemini JSON turn.
    /// Returns `None` if the payload doesn't contain actual conversational content (like metadata or keep-alives).
    pub fn parse_content(gemini_response: &str) -> Option<GeminiEvent>{
        let json_response = serde_json::from_str::<Value>(gemini_response).unwrap();
        
        if let Some(value) = json_response.pointer("/serverContent/modelTurn/parts") {
            if let Some(parts) = value.as_array() {
                for part in parts {
                    if let Some(text) = part["text"].as_str() {
                        return Some(GeminiEvent::Text(text.to_string()));
                    }
                    if let Some(data) = part["inlineData"]["data"].as_str() {
                        if let Ok(audio) = base64::engine::general_purpose::STANDARD.decode(data) {
                            return Some(GeminiEvent::Audio(audio));
                        }
                    }
                }
            }
        }
        None
    }
}