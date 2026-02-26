use serde_json::{json, Value};
use serde::Serialize;

const GEMINI_MODEL: &str = "models/gemini-2.5-flash-native-audio-preview-12-2025";

#[derive(Serialize)]
pub struct VoiceAnalysis {
    pub analysis: String,
}

pub fn create_gemini_message(instruction_text: &str, tools: Option<Vec<serde_json::Value>>) -> String {
        
        let tool_config = if let Some(t) = tools {
            Some(json!([{ "function_declarations": t}]))
        } else {
            None
        };

        let mut setup_json = json!({
            "setup": {
                "model": GEMINI_MODEL,
                "generationConfig": {
                    "responseModalities": ["audio"],
                },
                "systemInstruction": {
                    "parts": [{ "text": instruction_text }]
                }
            }
        });

        if let Some(t_config) = tool_config {
            if let Some(setup_obj) = setup_json.get_mut("setup").and_then(|s| s.as_object_mut()) {
                setup_obj.insert("tools".to_string(), t_config);
            }
        }

        setup_json.to_string()

}

pub fn define_tool(name: &str, description: &str, parameters: Value) -> Value {
    json!({
        "name": name,
        "description": description,
        "parameters": parameters
    })
}
