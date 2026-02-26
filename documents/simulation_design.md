# UI Concept: The Caption Hub

**Goal:** Break the traditional "chatbot" illusion to create a highly immersive, real-time social simulation environment. Keep the user in "conversing mode" rather than "typing/reading mode."

## Core Philosophy
In a real interview or date, you aren't looking at a script of what the other person just said; you are focusing on the moment and the environment. The UX must reflect this real-world presence.

## Layout & Architecture
A clean, centered, distraction-free screen that scales elegantly from mobile to desktop.

1.  **Background / Environment**
    *   Subtle, out-of-focus background that fits the current scenario (e.g., a blurred coffee shop for a date, a blurred modern office for an interview).
    *   This instantly grounds the user in the context of the practice session.
2.  **The Caption Hub (Center Stage)**
    *   The center of the screen is dedicated to the active conversation. 
    *   Instead of a scrolling chat log, only the **current sentence** being spoken by the AI fades in and out at the center of the screen, acting like high-end movie closed captions.
    *   The transcript history is hidden entirely during the live session to force active listening.
3.  **Active Audio Indicator**
    *   A clean, central visualizer or "pulsing orb" sits just above the captions.
    *   When the user speaks, it reacts to their volume/pitch (e.g., glowing blue). 
    *   When the AI speaks, it reacts to its voice (e.g., glowing purple).
4.  **Live Sensor Metrics (The Dashboard)**
    *   The real-time metrics (Pitch, Volume, Speaking Status) sit elegantly in a glass-morphic row at the very bottom of the screen (or in subtle floating `Card` components in the corners).
    *   This provides instant biofeedback without distracting from the eye-line of the conversation.

## Post-Simulation Review
Since the transcript is hidden during the live practice, the full conversation log and detailed coach analysis are revealed on a dedicated "Review" screen immediately after the session concludes.
