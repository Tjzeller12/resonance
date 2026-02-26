use serde_json::Value;
use base64::Engine;

pub struct GeminiParser;
pub enum GeminiEvent {
    Audio(Vec<u8>),
    Text(String)
}

impl GeminiParser {
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