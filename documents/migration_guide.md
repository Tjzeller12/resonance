# Migration Guide: Project Resonance (React-Hume-Rust)

## Part 1: The Frontend Pivot (Expo -> React Web)
**Goal:** Transition from React Native to a high-performance React Web App (Vite). This leverages the **Hume AI React SDK** for robust voice handling while retaining the ability to deploy to mobile via Capacitor later.

### 1. Archive Legacy Code
First, move the current Expo app out of the way to start fresh.
```bash
# In project root
mv app app-legacy
```

### 2. Scaffold New Client
Create a new Vite project with TypeScript.
```bash
# Create new project
npm create vite@latest web-client -- --template react-ts

# Enter directory
cd web-client

# Install dependencies
npm install
npm install @humeai/voice-react lucide-react framer-motion clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p
```

### 3. Configure Tailwind
Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add directives to `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 4. Basic Implementation Pattern
The core pattern involves wrapping your app in `VoiceProvider` and using hooks to access state.

**`src/main.tsx`:**
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { VoiceProvider } from '@humeai/voice-react'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VoiceProvider auth={{ type: 'apiKey', value: import.meta.env.VITE_HUME_API_KEY }}>
      <App />
    </VoiceProvider>
  </React.StrictMode>,
)
```

**`src/App.tsx`:**
```tsx
import { useVoice } from '@humeai/voice-react';

function App() {
  const { connect, disconnect, status } = useVoice();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white">
      <div className="text-2xl font-bold mb-4">Status: {status.value}</div>
      <button 
        onClick={() => connect()}
        className="px-6 py-3 bg-blue-600 rounded-full font-semibold hover:bg-blue-500 transition"
      >
        Start Conversation
      </button>
    </div>
  );
}

export default App;
```

---

## Part 2: Backend Refactor (The Physics Engine)
**Goal:** Strip down the Rust server to remove all AI orchestration logic (Gemini/Grok calls). It becomes a specialized high-performance WebSocket server that only calculates audio metrics (Pitch, Volume, Variance).

### 1. Remove Legacy Dependencies
In [server/Cargo.toml](file:///Users/thomaszeller/Desktop/resonance/server/Cargo.toml), remove crates related to Gemini or external HTTP requests if no longer needed (though `reqwest` might be useful for other things later).

### 2. Clean Up [main.rs](file:///Users/thomaszeller/Desktop/resonance/server/src/main.rs)
The [handle_socket](file:///Users/thomaszeller/Desktop/resonance/server/src/main.rs#56-150) function should be simplified to a single loop:

**[server/src/main.rs](file:///Users/thomaszeller/Desktop/resonance/server/src/main.rs) Logic:**
```rust
// ... imports ...

async fn handle_socket(mut socket: WebSocket) {
    let mut audio_processor = sensors::AudioProcessor::new();

    loop {
        if let Some(msg) = socket.recv().await {
            if let Ok(Message::Binary(audio_data)) = msg {
                // 1. Process Audio for Physics
                let samples = convert_to_i16(&audio_data);
                let metrics = audio_processor.process(&samples);

                // 2. Broadcast Metrics back to Client
                let response = serde_json::to_string(&metrics).unwrap();
                socket.send(Message::Text(response)).await.ok();
            }
        }
    }
}
```

### 3. Verify
Run `cargo run` in the `server` directory. It should compile faster and be extremely lightweight.

---

## Part 3: Connecting the Worlds (Dual-Stream)
To get both AI (Hume) and Physics (Rust), the client needs to split the audio stream.

**Strategy:**
1.  **Hume SDK:** Handles the primary microphone access and AI conversation.
2.  **AudioContext Tap:** We tap into the specific `MediaStream` used by Hume (or capture our own) and pipe it to a `ScriptProcessor` or `AudioWorklet`.
3.  **WebSocket:** The Worklet sends raw PCM data to `ws://localhost:3000/ws` (Rust Server).

**Result:**
- User speaks once.
- Hume hears it (AI responds).
- Rust hears it (Calculates "Confidence: 85%").
- UI updates with both AI text and a live confidence meter.
