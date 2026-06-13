use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tokio::sync::mpsc;
use tower_http::cors::{CorsLayer, Any};
use tracing::{info, warn};
use serde::Serialize;
mod api;
mod compiler;
mod conversation_analyzer;
mod deepgram;
mod gemini;
mod gemini_live;
mod gemini_msg;
mod rubrics;
mod sensors;

use gemini_live::{GeminiLiveStreamer, GeminiStreamMessage, LiveTags};

const SERVER_PORT: u16 = 3000;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .init();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "Resonance Server Active" }))
        .route("/ws", get(ws_handler))
        .route("/api/compile", post(compiler::compile_handler))
        .route("/api/analyze", post(conversation_analyzer::analyze_handler))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], SERVER_PORT));
    info!("🚀 Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

/// Envelope for all messages sent to the frontend.
#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
enum ServerMessage {
    AudioMetrics(sensors::SensorMetrics),
    WordBatch(deepgram::WordBatch),
    LiveTags(LiveTags),
}

/// Serializes a message and sends it to the frontend.
/// Returns `false` if the socket is gone and the session loop should end.
async fn send_to_client(socket: &mut WebSocket, message: &ServerMessage) -> bool {
    let json = match serde_json::to_string(message) {
        Ok(json) => json,
        Err(e) => {
            warn!("Failed to serialize server message: {}", e);
            return true;
        }
    };
    if let Err(e) = socket.send(Message::Text(json.into())).await {
        warn!("Failed to send message to client: {:?}", e);
        return false;
    }
    true
}

/// Handles a single WebSocket client connection.
///
/// On first audio chunk: opens a Gemini Live streaming connection.
/// Each audio chunk is processed locally (pitch/volume) and forwarded to Gemini.
/// Gemini's qualitative tags are forwarded to the client in real-time.
async fn handle_socket(mut socket: WebSocket) {
    info!("New WebSocket connection established");

    let mut audio_processor = sensors::AudioProcessor::new();
    let mut gl_stream: Option<GeminiLiveStreamer> = None;

    // Channel for receiving tag batches from Gemini Live reader task
    let (tags_tx, mut tags_rx) = mpsc::unbounded_channel::<LiveTags>();

    // The vocal engine is scenario-agnostic — it only analyzes delivery.
    // Scenario-specific judgment happens later in the post-match analyzer.
    let system_instruction = gemini_msg::get_vocal_engine_prompt();

    let mut was_speaking = false;

    loop {
        tokio::select! {
            // Branch 1: Message from frontend
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Binary(audio_data))) => {
                        // Start Gemini Live stream on first audio chunk
                        if gl_stream.is_none() {
                            match GeminiLiveStreamer::connect(tags_tx.clone(), &system_instruction).await {
                                Ok(stream) => {
                                    info!("🎙️ Gemini Live stream started");
                                    gl_stream = Some(stream);
                                }
                                Err(e) => {
                                    warn!("Failed to start Gemini stream: {}", e);
                                }
                            }
                        }

                        // Forward raw bytes to Gemini Live Streamer
                        if let Some(ref stream) = gl_stream {
                            let _ = stream.audio_tx.send(GeminiStreamMessage::Audio(audio_data.to_vec()));
                        }

                        // Local DSP processing
                        let samples: Vec<i16> = audio_data.chunks_exact(2)
                            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
                            .collect();

                        let metrics = audio_processor.process(&samples);
                        
                        // Check if speaking state changed from true to false
                        if was_speaking && !metrics.is_speaking {
                            info!("User finished speaking! Triggering TurnComplete to Gemini.");
                            if let Some(ref stream) = gl_stream {
                                let _ = stream.audio_tx.send(GeminiStreamMessage::TurnComplete);
                            }
                        }
                        was_speaking = metrics.is_speaking;

                        if !send_to_client(&mut socket, &ServerMessage::AudioMetrics(metrics)).await {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("WebSocket closed normally");
                        break;
                    }
                    Some(Err(e)) => {
                        warn!("WebSocket error: {}", e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }

            // Branch 2: Live Tags from Gemini Live
            Some(tags) = tags_rx.recv() => {
                if !send_to_client(&mut socket, &ServerMessage::LiveTags(tags)).await {
                    break;
                }
            }
        }
    }

    // Cleanup: drop the Gemini Live stream
    drop(gl_stream);
    info!("Session ended");
}