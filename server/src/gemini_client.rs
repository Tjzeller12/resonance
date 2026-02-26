use futures::SinkExt;
use tokio::net::TcpStream;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message,MaybeTlsStream, WebSocketStream};
use url::Url;

pub type GeminiStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

const GEMINI_URL: &str = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";



pub struct GeminiClient;

impl GeminiClient {
    pub async fn connect(api_key: &str, setup_msg: String) -> Result<GeminiStream,
     Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}?key={}", GEMINI_URL, api_key);
        let url = Url::parse(&url)?;
        println!("Connecting to Gemini...");
        let (mut ws_stream, _) = connect_async(url.to_string()).await?;
        println!("Connected to Gemini!");

        ws_stream.send(Message::Text(setup_msg.into())).await?;

        Ok(ws_stream)
    }
}