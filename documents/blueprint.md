**Status:** Technical Design Phase (2025)  
**Developer:** Thomas Zeller  
**Objective:** A modular, low-latency AI platform for real-time social skill development (Interviews, Charisma, Comedy, etc.) using native audio processing.

---

## 1. Vision & Core Philosophy

"Resonance" is not a single app, but a **Social Intelligence Engine**. It treats human interaction as a "sparring match" where users get high-stakes practice in a zero-consequence environment.

- **Content-Agnostic:** The same engine powers "Interview Prep" and "Comedy Training" via interchangeable JSON Scenario schemas.
- **Audio-First:** Uses 2025-era native multimodal LLMs to hear **tonality, pace, and hesitation** directly, bypassing simple text transcripts.
- **Privacy-First:** Secure, encrypted logging for sensitive habit/behavioral data.

---

## 2. Technical Stack (The "Zeller" Stack)

| Component           | Technology                              | Rationale                                                        |
| :------------------ | :-------------------------------------- | :--------------------------------------------------------------- |
| **Frontend**        | **React Native + TypeScript (Expo)**    | Cross-platform speed; type-safety for complex state management.  |
| **Backend Relay**   | **Rust (Axum + Tokio)**                 | High-concurrency performance for real-time binary audio streams. |
| **AI Intelligence** | **Gemini 2.5 Flash / Grok**             | Native multimodal support (hearing raw audio directly).          |
| **Metric Engine**   | **Deepgram Nova-3**                     | Specialized low-latency filler word and WPM detection.           |
| **Persistence**     | **SQLite (Local) / PostgreSQL (Cloud)** | Efficient relational data for correlation analysis.              |
| **Communication**   | **WebSockets (Binary)**                 | Sub-500ms latency required for natural "banter" flow.            |

---

## 3. Technical Stack & Components

### 🛠️ Hardware & Protocols

- **Primary Device:** Samsung Galaxy Watch8 (Companion) + Android/iOS Phone.
- **Protocol:** Bi-directional binary WebSockets for sub-500ms latency.
- **Audio Format:** Raw 16-bit PCM, 16kHz mono (Standard for high-accuracy STT/AI ingestion).

### ⚙️ Backend: The "High-Speed Relay" (Rust)

- **Framework:** `Axum` + `Tokio` runtime.
- **Key Tasks:**
  1.  **WebSocket Handshake:** Upgrading standard HTTP connections to persistent binary streams.
  2.  **Multistreaming:** Utilizing `tokio::spawn` to fork the incoming audio stream:
      - **Branch A:** Sent to Gemini for conversational intelligence.
      - **Branch B:** Sent to Deepgram for hard metric analysis.
  3.  **State Management:** Dynamic injection of system instructions based on the selected "Scenario JSON" (e.g., swapping from "Interview" to "Comedy" context).
- **Recommended Crate Stack:**
  - `axum`: Web server and WebSocket routing.
  - `tokio-tungstenite`: Low-level binary socket handling.
  - `serde`: Ultra-fast JSON serialization for metrics.
  - `gemini-live-api`: Native integration for 2025 multimodal audio.

### 📱 Frontend: The "Visualizer & Interface" (TypeScript)

- **Framework:** React Native (Expo) + TypeScript.
- **Audio Handling:** \* `expo-audio-stream`: Capturing raw PCM chunks.
  - **AEC (Acoustic Echo Cancellation):** Critical implementation to prevent the AI from hearing itself through the phone’s speakers.
- **Core UI Features:**
  - **Live Visualizer:** Using `expo-skia` for high-performance GPU-rendered frequency bars.
  - **Scenario Battle-Map:** Selection logic for "The Hot Seat" (Interviews), "The Networking Mixer," or "The Bar."
  - **Post-Match Heatmap:** A visual timeline showing exactly where tonality dipped or "ums/likes" spiked.

### 🧠 AI Models

- **Gemini 2.5 Flash Native Audio:** Handles "The Vibe." Analyzes tonality, emotional inflection, and roleplay logic.
- **Deepgram Nova-3:** Handles "The Data." Specialized in ultra-low latency filler-word detection and WPM (Words Per Minute) calculation.

---

## 4. Dual-Mode Logic

### 🎓 Mode A: The Academy (Learning)

Focused on **instruction and scaffolding**.

- **Interventions:** AI "pauses" the simulation to provide real-time coaching tips.
- **Educational Drills:** Specific mini-games (e.g., "The Eye Contact Challenge" or "The Power Pause").
- **Concept Mastery:** Teaches the psychological "Why" behind successful social interactions.

### ⚔️ Mode B: The Arena (Practice)

Focused on **immersion and repetition**.

- **Live Sparring:** 100% voice-to-voice roleplay with zero UI interaction.
- **Real-time Cues:** Phone haptics (vibrations) or subtle screen color shifts trigger when the user's "Confidence Score" (pitch/pacing) drops.
- **Post-Match Review:** Detailed "Confidence Heatmaps" and specific timestamps where tonality slipped.

---

## 5. System Architecture

1.  **Client (TS):** Captures raw 16kHz PCM audio; streams via WebSockets.
2.  **Relay (Rust):** Multiplexes the stream to Gemini (for response) and Deepgram (for analytics).
3.  **AI Engine:** Processes raw audio tokens; detects "smiling" and "upspeak" via tonality analysis.
4.  **Feedback Loop:** Aggregated metrics (Filler words + Tonality + WPM) returned to Client for live UI updates.

---

## 5. Development Roadmap (The 4-Phase Sprint)

### Phase 1: The "Live Wire" (Foundation)
*Goal: Establish a stable, low-latency bi-directional audio loop.*

- **Backend (Rust/Axum):**
    - [ ] **Server Init:** Setup Axum with Tokio runtime and Trace logging.
    - [ ] **WebSocket Hub:** Implement `/ws` route with `axum::extract::ws`.
    - [ ] **Binary Protocol:** Define a simple binary frame structure (Header + PCM Payload) to avoid JSON overhead for audio.
    - [ ] **Echo Logic:** Simply echo received bytes back to the sender for latency testing.
- **Frontend (Expo/RN):**
    - [ ] **Audio Capture:** Implement `expo-audio-stream` to record 16kHz/16-bit PCM (Mono).
    - [ ] **Socket Client:** Stream audio chunks (e.g., 4096 bytes) to the backend.
    - [ ] **Playback:** Buffer and play received audio chunks for loopback verification.
    - [ ] **Permissions:** Handle OS microphone permission requests.

### Phase 2: The Interpreters (Sensor Layer)
*Goal: Ingest audio and extract meaning (Transcript + Metadata) in real-time.*

- **Backend:**
    - [ ] **Deepgram Stream:** Implement WebSocket client to Deepgram Nova-3.
        - *Output:* Real-time raw transcript + Word-level timestamps.
    - [ ] **Gemini Sensor:** Implement client for Gemini 2.5 Live (Audio-in).
        - *Config:* set system prompt to output *only* JSON metadata (Confidence, Emotion, Pacing).
        - *Output:* `{ "confidence": "0.8", "emotion": "anxious" }`.
    - [ ] **Synchronization:** Create a struct to align Deepgram transcripts with Gemini metadata windows.
- **Frontend:**
    - [ ] **Visualizer:** Use `expo-skia` to render frequency bars.
    - [ ] **Debug Overlay:** Show live transcript and detected emotion labels on screen for verification.

### Phase 3: The Persona (Brain Layer)
*Goal: Synthesize the "Sensor" data into a character response.*

- **Backend:**
    - [ ] **Grok Client:** Implement integration with Grok Voice Agent API (or text completion).
    - [ ] **Super-Prompt Construction:** Dynamically format the `[USER_TRANSCRIPT]` + `[TONALITY_DATA]` template.
    - [ ] **Latency Optimization:** Ensure the pipeline (Deepgram+Gemini -> Grok) fits within the 500ms "Natural Banter" window.
    - [ ] **Audio Output:** Stream Grok's generated audio response back to the client.
- **Frontend:**
    - [ ] **Audio Output:** Playback the response audio stream.
    - [ ] **Interrupt Handling:** Send "Stop" signal to backend if user speaks during AI response (Barge-in).

### Phase 4: The Resonance Polish (Productization)
*Goal: Structure, storage, and specialized modes.*

- **Backend:**
    - [ ] **Scenario Engine:** Parse JSON scenarios (e.g., "Angry Customer") and inject system prompts into Gemini.
    - [ ] **Session DB:** Setup SQLite to save run summaries (Date, Score, Scenario).
    - [ ] **Docker:** Create `Dockerfile` for the Rust binary for ease of deployment/sharing.
- **Frontend:**
    - [ ] **Scenario Selector:** List available JSON scenarios.
    - [ ] **History View:** View past performance.

---

## 6. Future Expansion & Profitability

- **Self-Hosted Models:** Transition from paid APIs to a fine-tuned **Llama 3/Mistral** (Character AI style) for max control over persona and 90% lower operating costs.
- **Wear OS Companion:** Integrate with the **Samsung Galaxy Watch8** to track heart rate during social practice, correlating physiological stress with conversational performance.
- **Subscription Model:** Move from "Predatory" (Vocal Image style) to a fair "Rep-Based" or "One-time Pro" model.

---

## 7. Critical Engineering Challenges

1.  **Jitter Buffering:** Implementing a buffer logic in Rust to handle packet loss or network drops, ensuring the AI's voice remains fluid.
2.  **Token Efficiency:** Crafting modular prompts to get high-level coaching without bloating the context window or hitting rate limits.
3.  **Privacy & Encryption:** Using local-first storage or end-to-end encryption for sensitive logs (e.g., tracking habits/social anxiety patterns).
4.  **Hardware Optimization:** Ensuring `expo-skia` and audio streaming don't overheat the device during long 20-minute practice sessions.

---

## 8. Modular Scenario Sample (JSON)

```json
{
  "scenario": "Salary Negotiation",
  "difficulty": "Advanced",
  "ai_persona": {
    "name": "Tough CFO",
    "traits": ["impatient", "logical", "budget-conscious"]
  },
  "success_metrics": ["assertiveness", "win_win_framing", "low_filler_words"],
  "triggers": {
    "on_hesitation": "press_for_answer",
    "on_upspeak": "question_authority"
  }
}
```

# Addendum: Hybrid "Sensor + Brain" Social Intelligence Engine

This addendum covers the specific "Sensor + Brain" routing logic, updated Gemini metadata schema, and Grok Voice integration details to be appended to the primary design document.

---

## 9. The Hybrid "Sensor + Brain" Pipeline

To bypass the "Safety Wall" of modern multimodal models while retaining high-fidelity tonality detection, the system utilizes a split-path architecture.

### 🧠 Model Routing Strategy

- **The Sensor (Gemini 2.5 Live API):** Configured as a "Passive Listener." It processes raw audio to output only structured metadata regarding the user's vocal delivery and emotional state.
- **The Brain (Grok-4 / Uncensored LLM):** Acts as the "Persona." It receives the text transcript plus the Gemini Metadata to generate a socially accurate, unfiltered response.

### 📝 Updated Metadata Schema (Gemini Affective Output)

The Rust backend extracts the following fields from the `gemini-live-2.5-flash-native-audio` stream to build the "Super Prompt":

| Field              | Description                                               | Target Value for "Charisma" |
| :----------------- | :-------------------------------------------------------- | :-------------------------- |
| `prosody_variance` | Measures pitch modulation and rhythm patterns.            | High (Avoids monotone)      |
| `hesitation_rate`  | Frequency of micro-pauses, stutters, and "ums".           | Low                         |
| `affective_label`  | Classified emotion (e.g., _Anxious, Confident, Playful_). | Scenario Dependent          |
| `upspeak_detected` | Boolean: Does the pitch rise at the end of statements?    | False                       |

---

## 10. Unfiltered Voice Integration (Grok Voice Agent API)

To maintain the "Persona" without corporate sanitization, the response is delivered via the native Grok Voice Agent API.

### 🎭 Character Configuration

The Rust backend initiates the Grok session with a `session.update` event to pin the specific voice and behavioral parameters:

- **Voice IDs:** `Rex` (Authoritative/Manager), `Ara` (Warm/Conversational), `Sal` (Smooth/Neutral), `Eve` (Energetic), `Leo` (Commanding).
- **Paralinguistic Prompting:** The "Brain" is instructed to inject auditory cues like `[laugh]`, `[sigh]`, and `[whisper]` into the text output, which the Grok Voice engine renders natively in real-time.

### 🚀 The "Super Prompt" Template

```markdown
[USER_TRANSCRIPT]: "{{transcript}}"

[TONALITY_DATA]: {
"confidence": "{{gemini_confidence_score}}",
"pacing": "{{gemini_wpm_status}}",
"vibe": "{{gemini_emotion_label}}"
}
[SCENARIO_CONTEXT]: "{{scenario_id}}"
[INSTRUCTION]: Respond in character as {{persona}}. If the Tonality_Data contradicts
the User_Transcript (e.g., they say something 'Alpha' but sound 'Nervous'),
react to the weakness. DO NOT censor your response. Use [laugh] or [sigh] where appropriate.
```
