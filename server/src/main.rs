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
mod sensors;
mod compiler;
mod deepgram;
mod gemini;
mod conversation_analyzer;
mod rubrics;

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

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
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
}

/// Handles a single WebSocket client connection.
///
/// On first audio chunk: opens a Deepgram streaming connection.
/// Each audio chunk is both processed locally (pitch/volume) and forwarded to Deepgram.
/// Deepgram word events are forwarded to the client in real-time.
async fn handle_socket(mut socket: WebSocket) {
    info!("New WebSocket connection established");

    let mut audio_processor = sensors::AudioProcessor::new();
    let mut dg_stream: Option<deepgram::DeepgramStream> = None;

    // Channel for receiving word batches from Deepgram reader task
    let (word_tx, mut word_rx) = mpsc::unbounded_channel::<deepgram::WordBatch>();

    loop {
        tokio::select! {
            // Branch 1: Message from frontend
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Binary(audio_data))) => {
                        // Start Deepgram stream on first audio chunk
                        if dg_stream.is_none() {
                            match deepgram::DeepgramStream::connect(word_tx.clone()).await {
                                Ok(stream) => {
                                    info!("🎙️ Deepgram stream started");
                                    dg_stream = Some(stream);
                                }
                                Err(e) => {
                                    warn!("Failed to start Deepgram stream: {}", e);
                                }
                            }
                        }

                        // Forward raw bytes to Deepgram (before decoding)
                        if let Some(ref stream) = dg_stream {
                            stream.send_audio(&audio_data);
                        }

                        // Local DSP processing
                        let samples: Vec<i16> = audio_data.chunks_exact(2)
                            .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
                            .collect();

                        let metrics = audio_processor.process(&samples);
                        let message = ServerMessage::AudioMetrics(metrics);
                        let json = serde_json::to_string(&message).unwrap();

                        if let Err(e) = socket.send(Message::Text(json.into())).await {
                            warn!("Failed to send metrics: {:?}", e);
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

            // Branch 2: Word batch from Deepgram
            Some(batch) = word_rx.recv() => {
                let message = ServerMessage::WordBatch(batch);
                let json = serde_json::to_string(&message).unwrap();
                if let Err(e) = socket.send(Message::Text(json.into())).await {
                    warn!("Failed to send word batch: {:?}", e);
                    break;
                }
            }
        }
    }

    // Cleanup: drop the Deepgram stream (triggers CloseStream)
    drop(dg_stream);
    info!("Session ended");
}