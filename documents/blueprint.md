**Status:** Technical Design Phase (2025)  
**Developer:** Thomas Zeller  
**Objective:** A modular, low-latency AI platform for real-time social skill development (Interviews, Charisma, Comedy, etc.) using native audio processing.

---

## 1. Vision & Core Philosophy

"Resonance" is not a single app, but a **Social Intelligence Engine**. It treats human interaction as a "sparring match" where users get high-stakes practice in a zero-consequence environment.

- **Content-Agnostic:** The same engine powers "Interview Prep" and "Comedy Training" via interchangeable JSON Scenario schemas.
- **Audio-First:** Uses **Hume AI** and **Grok** to hear **tonality, pace, and hesitation** directly, bypassing simple text transcripts.
- **Privacy-First:** Secure, encrypted logging for sensitive habit/behavioral data.

---

## 2. Technical Stack (The "Zeller" Stack v2)

| Component           | Technology                              | Rationale                                                        |
| :------------------ | :-------------------------------------- | :--------------------------------------------------------------- |
| **Frontend**        | **React (Vite) + Capacitor**            | Fast development, vast ecosystem, easy mobile deployment.        |
| **AI Engine**       | **Hume EVI 3 (React SDK)**              | "The Full Stack." Handles Ear, Brain, and Voice client-side.     |
| **Physics Backend** | **Rust (Axum + Tokio)**                 | "The Physics Engine." Analysis (Pitch/Volume) & Game State.      |
| **Persistence**     | **SQLite (Local) / PostgreSQL (Cloud)** | Efficient relational data for correlation analysis.              |
| **Communication**   | **WebSockets (Binary)**                 | Dual-stream architecture: Audio -> Hume (SDK) & Audio -> Rust.   |

---

## 3. Technical Stack & Components

### 🛠️ Hardware & Protocols

- **Primary Device:** Capacitor-wrapped Web App (iOS/Android).
- **Data Strategy (The Tri-Stream):**
  1.  **Stream A (Audio):** Hume EVI (React SDK) handles conversation loop (VAD, STT, TTS).
  2.  **Stream B (Audio):** Custom `AudioContext` worklet streams raw PCM to Rust for "Physics" analysis.
  3.  **Stream C (Video):** Front-facing camera captures frames for **Hume Expression Measurement** (Face).

### ⚙️ Backend: The "Physics & State Engine" (Rust)

- **Framework:** `Axum` + `Tokio` runtime.
- **Key Tasks:**
  1.  **Physics Analysis:** Ingest raw audio stream to calculate `Volume` (RMS), `Pitch` (McLeod), and `Variance`.
  2.  **Game State:** Track session progress, scores, and historical data.
  3.  **Auth:** Managing user sessions.
  4.  **Post-Match Synthesis:** Aggregate [Audio Physics] + [Hume Prosody] + [Face Expressions] by timestamp.
- **Recommended Crate Stack:**
  - `axum`: Web server and WebSocket routing.
  - `tokio-tungstenite`: Low-level binary socket handling for physics stream.

### 📱 Frontend: The "Hume Client" (React + Vite)

- **Framework:** React + Vite + Capacitor.
- **AI Integration:** `@humeai/voice-react` SDK + Hume Expression API.
- **Core UI Features:**
  - **Hume Voice Provider:** Manages the conversation state.
  - **Physics Visualizer:** Renders real-time feedback from Rust backend.
  - **Face Tracker:** Captures local video stream for expression analysis.

### 🧠 AI Models

- **Hume EVI 3 (The All-in-One):**
    - **Ear:** VAD & Transcription.
    - **Brain:** LLM (Configurable via Hume Portal).
    - **Voice:** TTS (Configurable via Hume Portal).
- **Hume Expression Measurement:**
    - **Face:** Real-time emotion detection (Joy, Confusion, Fear, etc.).

---

## 4. Multi-Modal Analysis & Reporting

### 📊 The "Post-Match Report"
After a session, we generate a comprehensive report by verifying alignment across three dimensions:

| Dimension | Source | Metrics |
| :--- | :--- | :--- |
| **Verbal** | Hume EVI | Transcript accuracy, Filler words, WPM. |
| **Vocal** | Rust Physics | Pitch variance, Volume stability, Pause duration. |
| **Visual** | Hume Expression | Facial congruence (e.g., Smiling while saying "I'm sad"?). |

### 🧠 LLM Analysis
The aggregated JSON log (timestamped) is fed into a specialized LLM prompt to generate actionable feedback:
> "At 00:45, you said you were 'excited' but your face showed 'fear' (0.8) and your pitch dropped flatter. Work on congruent signaling."

### 🎓 Mode A: The Academy (Coach)
- **Config:** Prompt Hume to act as a supportive coach.

### ⚔️ Mode B: The Arena (Roleplay)
- **Config:** Prompt Hume to act as a tough adversary.

---

## 5. System Architecture

1.  **Client (React):**
    *   **Hume SDK:** Connects to `wss://api.hume.ai`.
    *   **Physics Socket:** Connects to `wss://rust-backend`.
2.  **Hume AI:** Handles the conversation loop (User Audio -> AI Response).
3.  **Rust Backend:** Receives copy of User Audio -> Calculates Physics -> Sends Metrics to Client.
4.  **UI:** Displays Hume status (Speaking/Listening) + Rust Physics (Pitch/Volume/Variance).

---

## 5. Development Roadmap (The 4-Phase Sprint)
*Goal: Establish a stable, low-latency bi-directional audio loop.*

- **Backend (Rust/Axum):**
    - [x] **Server Init:** Setup Axum with Tokio runtime and Trace logging.
    - [x] **WebSocket Hub:** Implement `/ws` route with `axum::extract::ws`.
    - [x] **Binary Protocol:** Define a simple binary frame structure (Header + PCM Payload) to avoid JSON overhead for audio.
    - [x] **Echo Logic:** Simply echo received bytes back to the sender for latency testing.
- **Frontend (Expo/RN):**
    - [x] **Audio Capture:** Implement `expo-audio-stream` to record 16kHz/16-bit PCM (Mono).
    - [x] **Socket Client:** Stream audio chunks (e.g., 4096 bytes) to the backend.
    - [x] **Playback:** Buffer and play received audio chunks for loopback verification.
    - [x] **Permissions:** Handle OS microphone permission requests.

### Phase 2: The Pivot (React + Hume SDK + Rust Physics)
*Goal: Re-establish the MVP with the new architecture.*

- **Step 0: Housekeeping (The Clean Slate)**
    - [x] **Archive:** Move `app` -> `app-legacy`.
    - [ ] **Scaffold:** Create `web-client` (React + Vite + TypeScript + Tailwind).
    - [ ] **Dependencies:** Install `@humeai/voice-react` and `lucide-react`.

- **Step 1: Backend Refactor (The Physics Engine)**
    - [ ] **Strip:** Remove all Gemini/LLM/ElevenLabs logic from `main.rs`.
    - [ ] **Simplify:** `ws_handler` only accepts binary audio -> calculates metrics -> broadcasts JSON.
    - [ ] **Verify:** Server runs with zero AI dependencies.

- **Step 2: Frontend Implementation (The Hume Client)**
    - [ ] **Hume Voice:** Implement `VoiceProvider` (API Key from .env).
    - [ ] **Dual-Stream:**
        1.  **Stream A:** Hume SDK (Internal Mic Access).
        2.  **Stream B:** `AudioContext` Worklet -> Rust WebSocket (Physics).

### Phase 3: The Polish & Analysis
*Goal: Optimization, Multimodal tracking, and Post-game reports.*

- **Multimodal Streams:**
    - [ ] **Face Tracker (Stream C):** Implement `Hume Expression Measurement` via webcam.
    - [ ] **Visualizer:** Re-implement `skia` graphs using HTML5 Canvas/D3.

- **Post-Match Report:**
    - [ ] **Backend Aggregation:** Align [AudioMetrics] + [HumeTranscript] + [FaceExpressions] by timestamp.
    - [ ] **LLM Analyst:** Send aggregated logs to LLM to generate "Coach Feedback" (Congruence Score).

### Phase 4: Production (Mobile & Persistence)
*Goal: Wrap for mobile and save history.*

- **Mobile:**
    - [ ] **Capacitor:** Wrap `web-client` for iOS/Android.
    - [ ] **Permissions:** Handle Mic/Camera permissions on native devices.

- **Persistence:**
    - [ ] **Session DB:** Save run summaries (Score, Date, Duration) to SQLite/Local.
    - [ ] **History UI:** View past performance reports.

---

## 9. The React + Hume Architecture

We have pivoted to a robust client-side AI architecture using the Hume SDK, while retaining the Rust backend for "Physics" and state.

```mermaid
graph TD
    User[User Audio] --> Client[React Client (Hume SDK)]
    
    %% Stream A: The AI Conversation (Handled by SDK)
    Client -- "Audio Stream (WebRTC/WS)" --> Hume[Hume EVI 3]
    Hume -- "Audio Response (Voice)" --> Client
    
    %% Stream B: The Physics Engine (Handled by Rust)
    Client -- "Raw PCM Stream (WS)" --> Ray[Rust Backend]
    Ray -- "Physics Metrics (Pitch/Vol)" --> UI[Visualizer]
```

### API Integration Strategy

#### A. Hume EVI 3 (The "Everything")
*   **Role:** Handles Ear, Brain, and Mouth via the React SDK.
*   **Input:** User Audio (managed by `useVoice` hook).
*   **Output:** TTS Audio + Transcript Events.
*   **Configuration:** Config ID set in Hume Portal (defines System Prompt & Voice).

#### B. Rust Backend (The "Physics Engine")
*   **Role:** Real-time signal processing.
*   **Input:** Raw PCM Stream (tapped from client AudioContext).
*   **Output:** `SensorMetrics` (Pitch, Volume, Variance).
*   **Why?** Provides the "Resonance" feedback loop (visuals/haptics) without processing AI logic.

### 📝 Hume Prosody Metadata Schema (Client-Side)

The React Client receives `prosdody` events directly from the SDK:

| Field              | Description                                               | Target Value for "Charisma" |
| :----------------- | :-------------------------------------------------------- | :-------------------------- |
| `calm`             | Measures steadiness and relaxation.                       | High                        |
| `anxiety`          | Frequency of micro-tremors and tension.                   | Low                         |
| `joy`              | Positive affect and warmth.                               | Scenario Dependent          |
| `awkwardness`      | Measures social disconnect or hesitation.                 | Low                         |

---

## 10. Persistence & State

- **Local:** `localStorage` for quick session settings.
- **Remote:** Rust Backend can store session summaries (Score, Duration, Date).
