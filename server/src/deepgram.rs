use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite;
use tracing::{info, warn};
use std::time::{SystemTime, UNIX_EPOCH};

/// A batch of finalized words from Deepgram streaming.
/// Sent to the frontend each time Deepgram finalizes a segment.
#[derive(Debug, Serialize, Clone)]
pub struct WordBatch {
    /// The epoch (Unix ms) when the Deepgram stream started.
    /// Frontend uses this to map Deepgram timestamps to sensor buffer times:
    ///   systemTime = stream_epoch_ms + word.start * 1000
    pub stream_epoch_ms: u64,
    /// Finalized words with timestamps relative to stream start.
    pub words: Vec<WordData>,
    /// Full transcript for this segment.
    pub transcript: String,
    /// True when Deepgram detects end-of-utterance (natural pause).
    /// Frontend uses this as a sentence boundary.
    pub speech_final: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct WordData {
    pub word: String,
    /// Seconds into the audio stream when this word started.
    pub start: f64,
    /// Seconds into the audio stream when this word ended.
    pub end: f64,
    /// Deepgram's confidence for this word (0.0 - 1.0).
    pub confidence: f64,
}

// --- Deepgram Streaming Response Types ---

#[derive(Deserialize, Debug)]
struct DgStreamResponse {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    channel: Option<DgChannel>,
    is_final: Option<bool>,
    speech_final: Option<bool>,
}

#[derive(Deserialize, Debug)]
struct DgChannel {
    alternatives: Vec<DgAlternative>,
}

#[derive(Deserialize, Debug)]
struct DgAlternative {
    transcript: Option<String>,
    words: Option<Vec<DgWord>>,
}

#[derive(Deserialize, Debug)]
struct DgWord {
    word: String,
    start: f64,
    end: f64,
    confidence: f64,
}

/// Manages a streaming WebSocket connection to Deepgram.
/// Audio chunks are forwarded in real-time; word events are emitted as they arrive.
pub struct DeepgramStream {
    audio_tx: mpsc::UnboundedSender<Vec<u8>>,
    pub stream_epoch_ms: u64,
}

impl DeepgramStream {
    /// Opens a streaming connection to Deepgram and spawns reader/writer tasks.
    /// Returns a handle for sending audio and a channel that emits WordBatch events.
    pub async fn connect(
        word_tx: mpsc::UnboundedSender<WordBatch>,
    ) -> Result<Self, String> {
        let api_key = std::env::var("DEEPGRAM_API_KEY")
            .map_err(|_| "DEEPGRAM_API_KEY not set".to_string())?;

        let url = "wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&encoding=linear16&sample_rate=16000&channels=1";

        let request = tungstenite::http::Request::builder()
            .uri(url)
            .header("Authorization", format!("Token {}", api_key))
            .header("Host", "api.deepgram.com")
            .header("Connection", "Upgrade")
            .header("Upgrade", "websocket")
            .header("Sec-WebSocket-Version", "13")
            .header("Sec-WebSocket-Key", tungstenite::handshake::client::generate_key())
            .body(())
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let (ws_stream, _) = tokio_tungstenite::connect_async(request)
            .await
            .map_err(|e| format!("Deepgram connect failed: {}", e))?;

        let stream_epoch_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        info!("🎙️ Deepgram streaming connected (epoch: {})", stream_epoch_ms);

        let (mut ws_write, mut ws_read) = ws_stream.split();
        let (audio_tx, mut audio_rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // Writer task: forward audio chunks to Deepgram
        tokio::spawn(async move {
            while let Some(data) = audio_rx.recv().await {
                if let Err(e) = ws_write.send(tungstenite::Message::Binary(data.into())).await {
                    warn!("Deepgram write error: {}", e);
                    break;
                }
            }
            // Signal Deepgram we're done sending audio
            let close_msg = serde_json::json!({"type": "CloseStream"});
            let _ = ws_write.send(tungstenite::Message::Text(close_msg.to_string().into())).await;
            info!("🔇 Deepgram writer closed");
        });

        // Reader task: parse word events and forward to frontend
        let epoch = stream_epoch_ms;
        tokio::spawn(async move {
            while let Some(msg) = ws_read.next().await {
                match msg {
                    Ok(tungstenite::Message::Text(text)) => {
                        let text_str: &str = &text;
                        if let Ok(resp) = serde_json::from_str::<DgStreamResponse>(text_str) {
                            // Only process finalized results (not interim)
                            if resp.is_final != Some(true) { continue; }

                            if let Some(channel) = resp.channel {
                                if let Some(alt) = channel.alternatives.first() {
                                    let words: Vec<WordData> = alt.words.as_ref()
                                        .map(|ws| ws.iter().map(|w| WordData {
                                            word: w.word.clone(),
                                            start: w.start,
                                            end: w.end,
                                            confidence: w.confidence,
                                        }).collect())
                                        .unwrap_or_default();

                                    if words.is_empty() { continue; }

                                    let batch = WordBatch {
                                        stream_epoch_ms: epoch,
                                        words,
                                        transcript: alt.transcript.clone().unwrap_or_default(),
                                        speech_final: resp.speech_final.unwrap_or(false),
                                    };

                                    if word_tx.send(batch).is_err() {
                                        return; // Frontend disconnected
                                    }
                                }
                            }
                        }
                    }
                    Ok(tungstenite::Message::Close(_)) => break,
                    Err(e) => { warn!("Deepgram read error: {}", e); break; }
                    _ => {}
                }
            }
            info!("🔇 Deepgram reader closed");
        });

        Ok(DeepgramStream { audio_tx, stream_epoch_ms })
    }

    /// Forward raw PCM bytes to Deepgram.
    pub fn send_audio(&self, pcm_bytes: &[u8]) {
        let _ = self.audio_tx.send(pcm_bytes.to_vec());
    }
}
