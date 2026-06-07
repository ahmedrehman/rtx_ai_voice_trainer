import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ServerAiConfig, ServerAiLogEvent } from "../lib_server_ai_voice";

export const apiKey = loadLocalEnvAndGetOpenAiKey();

export function createServerAiLogger() {
  const events: ServerAiLogEvent[] = [];
  return {
    events,
    logger(event: ServerAiLogEvent) {
      events.push(event);
    }
  };
}

export function serverAiConfig(patch: Partial<ServerAiConfig> = {}): ServerAiConfig {
  return {
    provider: "openai",
    implementation: patch.implementation || "openai-audio",
    openAiApiKey: apiKey,
    textModel: "gpt-4.1-mini",
    audioModel: "gpt-audio",
    transcriptionModel: "gpt-4o-mini-transcribe",
    ttsModel: "gpt-4o-mini-tts",
    voice: "coral",
    ...patch
  };
}

export function hasApiKey(t: { skip: (message?: string) => void }) {
  if (apiKey) return true;
  t.skip("NOT RUN - MISSING OPENAI_API_KEY");
  return false;
}

export function sampleAudioBase64() {
  return readFileSync(sampleAudioPath()).toString("base64");
}

export function sampleAudioFormData() {
  const bytes = readFileSync(sampleAudioPath());
  const formData = new FormData();
  formData.set("file", new Blob([bytes], { type: "audio/wav" }), "sample-voice-test.wav");
  formData.set("model", "gpt-4o-mini-transcribe");
  return formData;
}

function sampleAudioPath() {
  return join(process.cwd(), "public", "test-audio", "sample-voice-test.wav");
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
