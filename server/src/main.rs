use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tracing::{info, warn};
use serde::Serialize;
mod sensors;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok(); // Load .env
    // 1. Initialize Tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "server=debug,tower_http=debug".into()),
        )
        .init();

    // 2. Build App with /ws route
    let app = Router::new()
        .route("/", get(|| async { "Resonance Server Active" }))
        .route("/ws", get(ws_handler));

    // 3. Bind and Serve
    // Use 0.0.0.0 to listen on all interfaces (needed for Android/LAN access)
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("🚀 Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Upgrades the HTTP connection to a WebSocket
async fn ws_handler(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
enum ServerMessage {
    AudioMetrics(sensors::SensorMetrics),
}

/// Handles the actual WebSocket stream
async fn handle_socket(mut socket: WebSocket) {
    info!("New WebSocket connection established");

    let mut audio_processor = sensors::AudioProcessor::new();

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Binary(audio_data))=> {
                // 1. Process raw audio metrics
                let samples: Vec<i16> = audio_data.chunks_exact(2)
                    .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
                    .collect();
                
                let metrics = audio_processor.process(&samples);

                let message = ServerMessage::AudioMetrics(metrics);
                let json_response = serde_json::to_string(&message).unwrap();

                if let Err(e) = socket.send(Message::Text(json_response.into())).await {
                    warn!("Failed to send metrics: {:?}", e);
                    break;
                }
            }

            Ok(Message::Close(_)) => {
                info!("WebSocket closed connection normally");
                break; 
            }
            Err(e) => {
                warn!("Gemini error: {}", e);
                break;
            }
            _ => {} // Ignore other message types for now
        }
    }
}