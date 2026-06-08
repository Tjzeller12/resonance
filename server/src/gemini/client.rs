use base64::Engine;
use futures::SinkExt;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream};
use tracing::{info, warn};
use url::Url;

use super::types::*;

// ─── Constants ──────────────────────────────────────────────────────────────

const REST_BASE_URL: &str =
    "https://generativelanguage.googleapis.com/v1beta/models";

const LIVE_BASE_URL: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// ─── Stream Type Alias ──────────────────────────────────────────────────────

/// The raw WebSocket stream returned by the live client.
pub type GeminiStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

// ─── Builder ────────────────────────────────────────────────────────────────

/// Builder for constructing a configured Gemini client.
///
/// # Example (REST)
/// ```ignore
/// let result = GeminiClient::builder()
///     .model("gemini-3.5-flash")
///     .temperature(0.3)
///     .json_response()
///     .build_rest()?
///     .generate::<MyStruct>(&prompt)
///     .await?;
/// ```
///
/// # Example (Live/WebSocket)
/// ```ignore
/// let stream = GeminiClient::builder()
///     .model("gemini-2.5-flash-native-audio")
///     .response_modalities(vec!["audio".into()])
///     .system_instruction("You are a coach.")
///     .build_live()?
///     .connect()
///     .await?;
/// ```
pub struct GeminiClient;

impl GeminiClient {
    pub fn builder() -> GeminiClientBuilder {
        GeminiClientBuilder::default()
    }
}

pub struct GeminiClientBuilder {
    model: Option<String>,
    temperature: f32,
    system_instruction: Option<String>,
    tools: Option<Vec<Value>>,
    json_response: bool,
    response_modalities: Option<Vec<String>>,
}

impl Default for GeminiClientBuilder {
    fn default() -> Self {
        Self {
            model: None,
            temperature: 0.7,
            system_instruction: None,
            tools: None,
            json_response: false,
            response_modalities: None,
        }
    }
}

impl GeminiClientBuilder {
    /// Set the model name (e.g. "gemini-2.5-flash", "gemini-2.5-flash-native-audio-preview-12-2025").
    pub fn model(mut self, model: &str) -> Self {
        self.model = Some(model.to_string());
        self
    }

    /// Set the temperature (0.0 – 2.0). Default is 0.7.
    pub fn temperature(mut self, temp: f32) -> Self {
        self.temperature = temp;
        self
    }

    /// Set a system instruction that guides the model's behavior.
    pub fn system_instruction(mut self, instruction: &str) -> Self {
        self.system_instruction = Some(instruction.to_string());
        self
    }

    /// Attach tool/function declarations for function calling.
    pub fn tools(mut self, tools: Vec<Value>) -> Self {
        self.tools = Some(tools);
        self
    }

    /// Request structured JSON output (sets `responseMimeType: application/json`).
    pub fn json_response(mut self) -> Self {
        self.json_response = true;
        self
    }

    /// Set response modalities for live streaming (e.g. `["audio"]`, `["text"]`).
    pub fn response_modalities(mut self, modalities: Vec<String>) -> Self {
        self.response_modalities = Some(modalities);
        self
    }

    /// Build a REST client for one-shot generateContent calls.
    pub fn build_rest(self) -> Result<GeminiRestClient, GeminiError> {
        let api_key = std::env::var("GEMINI_API_KEY")
            .map_err(|_| GeminiError::ApiKeyMissing)?;
        let model = self.model.ok_or_else(|| {
            GeminiError::InvalidResponse("Model name is required".to_string())
        })?;

        Ok(GeminiRestClient {
            api_key,
            model,
            temperature: self.temperature,
            system_instruction: self.system_instruction,
            json_response: self.json_response,
        })
    }

    /// Build a Live (WebSocket) client for streaming audio/text.
    pub fn build_live(self) -> Result<GeminiLiveClient, GeminiError> {
        let api_key = std::env::var("GEMINI_API_KEY")
            .map_err(|_| GeminiError::ApiKeyMissing)?;
        let model = self.model.ok_or_else(|| {
            GeminiError::InvalidResponse("Model name is required".to_string())
        })?;

        Ok(GeminiLiveClient {
            api_key,
            model,
            system_instruction: self.system_instruction,
            tools: self.tools,
            response_modalities: self.response_modalities
                .unwrap_or_else(|| vec!["audio".to_string()]),
        })
    }
}

// ─── REST Client ────────────────────────────────────────────────────────────

/// A configured client for one-shot Gemini REST API calls.
pub struct GeminiRestClient {
    api_key: String,
    model: String,
    temperature: f32,
    system_instruction: Option<String>,
    json_response: bool,
}

impl GeminiRestClient {
    /// Send a prompt and deserialize the JSON response into the target type.
    ///
    /// The model must be configured with `.json_response()` for this to work reliably.
    pub async fn generate<T: DeserializeOwned>(&self, prompt: &str) -> Result<T, GeminiError> {
        let raw = self.generate_text(prompt).await?;
        let sanitized = preprocess_json(&raw);

        // Try direct parse first, then try as Vec<T> and take the first element
        match serde_json::from_str::<T>(&sanitized) {
            Ok(parsed) => Ok(parsed),
            Err(orig_err) => {
                // Attempt to parse as a Vec<T> (Gemini sometimes wraps in an array)
                match serde_json::from_str::<Vec<T>>(&sanitized) {
                    Ok(mut list) if !list.is_empty() => Ok(list.remove(0)),
                    _ => {
                        warn!(
                            "[Gemini REST] JSON Deserialization failed: {}. Raw Response (first 2000 chars):\n{}",
                            orig_err,
                            &sanitized[..sanitized.len().min(2000)]
                        );
                        Err(GeminiError::ParseError(format!(
                            "Failed to parse response: {}. Raw: {}",
                            orig_err,
                            &sanitized[..sanitized.len().min(1000)]
                        )))
                    }
                }
            }
        }
    }

    /// Send a prompt and return the raw text response.
    pub async fn generate_text(&self, prompt: &str) -> Result<String, GeminiError> {
        let url = format!(
            "{}/{}:generateContent?key={}",
            REST_BASE_URL, self.model, self.api_key
        );

        let mut request = RestRequest {
            contents: vec![Content {
                parts: vec![Part {
                    text: Some(prompt.to_string()),
                }],
                role: Some("user".to_string()),
            }],
            generation_config: GenerationConfig {
                response_mime_type: if self.json_response {
                    Some("application/json".to_string())
                } else {
                    None
                },
                temperature: self.temperature,
                response_modalities: None,
                max_output_tokens: Some(8192),
            },
            system_instruction: None,
        };

        if let Some(ref instruction) = self.system_instruction {
            request.system_instruction = Some(Content {
                parts: vec![Part {
                    text: Some(instruction.clone()),
                }],
                role: None,
            });
        }

        info!(
            "[Gemini REST] Sending to {} ({} chars)",
            self.model,
            prompt.len()
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());
        let response = client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| GeminiError::RequestFailed(format!("Failed to reach Gemini: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();
            warn!("[Gemini REST] Error {}: {}", status, body);
            return Err(GeminiError::ApiError { status, body });
        }

        let gemini_resp: RestResponse = response.json().await.map_err(|e| {
            GeminiError::InvalidResponse(format!("Failed to deserialize response: {}", e))
        })?;

        let candidate = gemini_resp
            .candidates
            .as_ref()
            .and_then(|c| c.first())
            .ok_or_else(|| GeminiError::InvalidResponse("No candidates returned".to_string()))?;

        let finish_reason = candidate.finish_reason.clone().unwrap_or_else(|| "UNKNOWN".to_string());
        
        let text = candidate
            .content
            .parts
            .first()
            .and_then(|p| p.text.as_ref())
            .ok_or_else(|| GeminiError::InvalidResponse("Empty response from Gemini".to_string()))?
            .clone();

        info!("[Gemini REST] Got response ({} chars, finish_reason: {})", text.len(), finish_reason);
        
        if finish_reason == "MAX_TOKENS" {
            warn!("[Gemini REST] Response truncated due to MAX_TOKENS limit!");
        }
        
        Ok(text)
    }
}

// ─── Live (WebSocket) Client ────────────────────────────────────────────────

/// A configured client for Gemini's BidiGenerateContent WebSocket API.
pub struct GeminiLiveClient {
    api_key: String,
    model: String,
    system_instruction: Option<String>,
    tools: Option<Vec<Value>>,
    response_modalities: Vec<String>,
}

impl GeminiLiveClient {
    /// Establish a WebSocket connection and send the setup message.
    /// Returns the raw stream for bidirectional audio/text communication.
    pub async fn connect(&self) -> Result<GeminiStream, GeminiError> {
        let url = format!("{}?key={}", LIVE_BASE_URL, self.api_key);
        let url = Url::parse(&url)
            .map_err(|e| GeminiError::RequestFailed(format!("Invalid URL: {}", e)))?;

        info!("[Gemini Live] Connecting...");
        let (mut ws_stream, _) = connect_async(url.to_string())
            .await
            .map_err(|e| GeminiError::RequestFailed(format!("WebSocket connect failed: {}", e)))?;
        info!("[Gemini Live] Connected!");

        let setup_msg = self.build_setup_message();
        ws_stream
            .send(Message::Text(setup_msg.into()))
            .await
            .map_err(|e| GeminiError::RequestFailed(format!("Failed to send setup: {}", e)))?;

        Ok(ws_stream)
    }

    /// Build the JSON setup message for the BidiGenerateContent session.
    fn build_setup_message(&self) -> String {
        let model_path = format!("models/{}", self.model);

        let mut setup_json = json!({
            "setup": {
                "model": model_path,
                "generationConfig": {
                    "responseModalities": self.response_modalities,
                },
            }
        });

        // Inject system instruction
        if let Some(ref instruction) = self.system_instruction {
            if let Some(setup_obj) = setup_json
                .get_mut("setup")
                .and_then(|s| s.as_object_mut())
            {
                setup_obj.insert(
                    "systemInstruction".to_string(),
                    json!({
                        "parts": [{ "text": instruction }]
                    }),
                );
            }
        }

        // Inject tools
        if let Some(ref tools) = self.tools {
            if let Some(setup_obj) = setup_json
                .get_mut("setup")
                .and_then(|s| s.as_object_mut())
            {
                setup_obj.insert(
                    "tools".to_string(),
                    json!([{ "function_declarations": tools }]),
                );
            }
        }

        setup_json.to_string()
    }

    /// Define a tool/function declaration for use with `.tools()`.
    pub fn define_tool(name: &str, description: &str, parameters: Value) -> Value {
        json!({
            "name": name,
            "description": description,
            "parameters": parameters
        })
    }
}

// ─── Response Parsing ───────────────────────────────────────────────────────

/// Parse a WebSocket message from Gemini's live API into a typed event.
/// Returns `None` for metadata, keep-alives, or other non-content messages.
pub fn parse_live_event(gemini_response: &str) -> Option<GeminiEvent> {
    let json_response = serde_json::from_str::<Value>(gemini_response).ok()?;

    if let Some(value) = json_response.pointer("/serverContent/modelTurn/parts") {
        if let Some(parts) = value.as_array() {
            for part in parts {
                if let Some(text) = part["text"].as_str() {
                    return Some(GeminiEvent::Text(text.to_string()));
                }
                if let Some(data) = part["inlineData"]["data"].as_str() {
                    if let Ok(audio) =
                        base64::engine::general_purpose::STANDARD.decode(data)
                    {
                        return Some(GeminiEvent::Audio(audio));
                    }
                }
            }
        }
    }
    None
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Cleans Gemini's output by removing markdown code block wrappers and trimming whitespace.
/// Gemini sometimes wraps JSON in ```json ... ``` blocks even when asked for raw JSON.
fn preprocess_json(raw: &str) -> String {
    let trimmed = raw.trim();
    let mut content = trimmed.to_string();

    if trimmed.starts_with("```") {
        let lines: Vec<&str> = trimmed.lines().collect();
        if lines.len() >= 2 {
            let end_idx = if lines
                .last()
                .map(|l| l.trim().starts_with("```"))
                .unwrap_or(false)
            {
                lines.len() - 1
            } else {
                lines.len()
            };
            content = lines[1..end_idx].join("\n").trim().to_string();
        }
    }

    // Escape literal newlines and tabs INSIDE json strings to prevent serde "control character" errors
    let mut sanitized = String::with_capacity(content.len());
    let mut in_string = false;
    let mut escaped = false;

    for c in content.chars() {
        if !escaped && c == '"' {
            in_string = !in_string;
            sanitized.push(c);
        } else if in_string {
            if c == '\n' {
                sanitized.push_str("\\n");
            } else if c == '\t' {
                sanitized.push_str("\\t");
            } else if c == '\r' {
                sanitized.push_str("\\r");
            } else {
                sanitized.push(c);
            }
            // Update escaped state
            if c == '\\' {
                escaped = !escaped;
            } else {
                escaped = false;
            }
        } else {
            sanitized.push(c);
            escaped = false;
        }
    }

    // --- JSON AUTO-REPAIR FOR INCOMPLETE OUTPUT ---
    let mut in_str = false;
    let mut is_escaped = false;
    let mut bracket_stack = Vec::new();

    for c in sanitized.chars() {
        if !is_escaped && c == '"' {
            in_str = !in_str;
        } else if !in_str {
            match c {
                '{' => bracket_stack.push('}'),
                '[' => bracket_stack.push(']'),
                '}' | ']' => {
                    bracket_stack.pop();
                }
                _ => {}
            }
        }
        is_escaped = if c == '\\' { !is_escaped } else { false };
    }

    if in_str {
        sanitized.push('"');
    }

    let trimmed_end = sanitized.trim_end();
    if trimmed_end.ends_with(',') {
        sanitized = trimmed_end[..trimmed_end.len() - 1].to_string();
    } else if trimmed_end.ends_with(':') {
        sanitized.push_str("null");
    } else if !trimmed_end.ends_with('}') && !trimmed_end.ends_with(']') && !trimmed_end.ends_with('"') && !trimmed_end.ends_with("true") && !trimmed_end.ends_with("false") && !trimmed_end.ends_with("null") {
        // if it ends with partial unquoted text like a number, it's usually fine
    }

    while let Some(c) = bracket_stack.pop() {
        sanitized.push(c);
    }

    sanitized
}
