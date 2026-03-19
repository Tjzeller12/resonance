import dotenv from "dotenv";
import { HumeClient } from "hume";
dotenv.config();

// The secret key allows you to manage configs, unlike the public VITE_ API key
const apiKey = process.env.VITE_HUME_SECRETE_KEY;

if (!apiKey) {
    console.error("FATAL: VITE_HUME_SECRETE_KEY not found in .env");
    process.exit(1);
}

const client = new HumeClient({ apiKey });

const SIMS = [
    {
        name: "Interview (Tech Manager)",
        voiceId: "59cfc7ab-e945-43de-ad1a-471daa379c67", 
        useClaude: true,
        type: "interview",
        prompt: `... (Your prompt from useEviManager.tsx) ...` 
    },
    {
        name: "Bar Pickup (Maya)",
        voiceId: "59cfc7ab-e945-43de-ad1a-471daa379c67", 
        useClaude: true,
        type: "bar_pickup",
        prompt: `... (Your Maya prompt) ...`
    },
    {
        name: "Dojo (Vocal Coach)",
        voiceId: "ee96fb5f-ec1a-4f41-a9ba-6d119e64c8fd", 
        useClaude: true,
        type: "dojo",
        prompt: `... (Your Marcus prompt) ...`
    }
];

async function createConfigs() {
    console.log("Creating Hume EVI 3 Configurations...");
    
    for (const sim of SIMS) {
        try {
            console.log(`Creating config for: ${sim.name}`);
            
            const payload = {
                eviVersion: "3",
                name: sim.name,
                prompt: { text: sim.prompt },
                voice: {
                    provider: "HUME_AI",
                    name: sim.voiceId // Depending on Hume's SDK, this might be 'id' or 'name'. 
                }
            };
            
            // Inject Claude 3.5 Sonnet if requested
            if (sim.useClaude) {
                payload.languageModel = {
                    modelProvider: "ANTHROPIC",
                    modelResource: "claude-3-5-sonnet-20241022"
                };
            }

            const response = await client.empathicVoice.configs.createConfig(payload);
            console.log(`✅ Success! [${sim.type}] -> configId: ${response.id}`);
            
        } catch (err) {
            console.error(`❌ Failed to create config for ${sim.name}:`, err.message);
        }
    }
    
    console.log("\nCopy those configId strings and paste them into your SIM_CONFIGS in useEviManager.tsx!");
}

createConfigs();
