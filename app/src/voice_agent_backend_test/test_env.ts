import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceAgentStreamTextChatEvent } from "../voice_agent";

export const apiKey = loadLocalEnvAndGetOpenAiKey();

export function serverConfig() {
  return {
    provider: "openai" as const,
    implementation: "openai-audio" as const,
    openAiApiKey: apiKey,
    textModel: "gpt-4.1-mini",
    audioModel: "gpt-audio",
    ttsModel: "gpt-4o-mini-tts",
    voice: "coral"
  };
}

export function hasApiKey(t: { skip: (message?: string) => void }) {
  if (apiKey) return true;
  t.skip("NOT RUN - MISSING OPENAI_API_KEY");
  return false;
}

export async function readVoiceAgentStreamEvents(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.startsWith("data:") ? part.slice(5).trim() : part)
    .map((jsonText) => JSON.parse(jsonText) as VoiceAgentStreamTextChatEvent);
}

export function sampleAudioBase64() {
  return readFileSync(join(process.cwd(), "public", "test-audio", "sample-voice-test.wav")).toString("base64");
}

function loadLocalEnvAndGetOpenAiKey() {
  for (const fileName of [".env.local", ".env", "../.env.local", "../.env"]) {
    try {
      const text = readFileSync(fileName, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // Optional local env file.
    }
  }
  return process.env.OPENAI_API_KEY || "";
}
