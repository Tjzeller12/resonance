# Phase 2: The Interpreters (Sensor Layer)

**Goal:** Transform the Rust server into a multi-modal perception engine. We extract **Objective Facts** (Audio + Text) and **Subjective Analysis** (Gemini) to feed an **Unfiltered Roleplay AI** (Grok).

## 1. The "Dual-Source" Architecture (Consolidated)

We have removed Deepgram to simplify the stack, as Gemini Multimodal Live provides fast transcripts automatically.

```mermaid
graph TD
    User[User Audio] --> Rust[Rust Server Switchboard]
    
    %% Branch 1: The Coach & Scribe (Gemini)
    Rust -- Audio Snapshot --> Gemini[Gemini Multimodal]
    Gemini -- "Transcript: 'Hello'" --> Aggregator
    Gemini -- "Confidence: Low (Monotone)" --> Coach[Coach UI Text]
    Gemini -- "Pace: 140wpm" --> Aggregator
    
    %% Branch 2: The Audio Processor (Real-time UI)
    Rust -- Raw Stream --> AudioProc[Audio Processor (Rust)]
    AudioProc -- "Vol: 80dB, Pitch: 220Hz" --> UI[Mobile Visualizer]
    AudioProc -- "Metrics" --> Aggregator
    
    %% The Synthesis (Roleplay)
    Aggregator -- "System: User said 'Hello' (Fast Pace, Anxious Tone)" --> Grok[Grok AI (Interviewer)]
    Grok -- "Audio Delta" --> Rust
    Rust -- "Audio Stream" --> User
```

## 2. API Integration Strategy

### A. Gemini (The Brain & Linguist)
*   **Role:** Transcriber + Analyst.
*   **Input:** User Audio.
*   **Output:** JSON Metadata + Transcript.
*   **Metrics Calculated:**
    *   **Pace (WPM):** Calculated from transcript timestamp deltas (more accurate than raw audio).
    *   **Sentiment:** "Anxious", "Confident", "Angry".

### B. Audio Processor (The Signal Engineer)
*   **Role:** Extract raw signal features for UI Visuals.
*   **Input:** Raw PCM Audio.
*   **Metrics Calculated:**
    *   **Volume (RMS):** For "Loudness" bar.
    *   **Pitch (Hz):** For "Intonation" curve.

### C. Grok (The Mouth)
*   **Role:** The Persona (Interviewer/Date).
*   **Endpoint:** `wss://api.x.ai/v1/realtime`
*   **Method:** Injection of Text Context.
    *   Event: `conversation.item.create`
    *   Payload: `content: [{ type: "input_text", text: "[User Transcript] [Context: User sounded Anxious]" }]`
*   **Output:** `response.output_audio.delta` (Direct PCM stream). 

## 3. Implementation Priorities

1.  **Branch 2 (Audio Processor) - IN PROGRESS:**
    *   Essential for real-time UI feedback.
    *   **Action:** Build Pitch/Volume calculator in Rust.

2.  **Branch 1 (Gemini Integration):**
    *   The "Brain" logic.
    *   **Action:** Connect to Gemini Multimodal WebSocket.

3.  **Synthesis (Grok Integration):**
    *   The "Persona".
    *   **Action:** Connect to Grok WebSocket and wire up the `input_text` -> `output_audio` pipeline.
