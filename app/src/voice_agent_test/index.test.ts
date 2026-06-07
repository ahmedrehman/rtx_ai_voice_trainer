import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  VOICE_AGENT_BACKEND,
  VOICE_AGENT_CREATE_SETTINGS,
  VOICE_AGENT_DEFAULT_SETTINGS,
  type VoiceAgentSettings
} from "../voice_agent";

loadLocalEnv();

const apiKey = process.env.OPENAI_API_KEY || "";

function serverConfig() {
  return {
    provider: "openai" as const,
    implementation: "openai-audio" as const,
    openAiApiKey: apiKey,
    textModel: "gpt-4.1-mini",
    ttsModel: "gpt-4o-mini-tts",
    voice: "coral"
  };
}

function hasApiKey(t: { skip: (message?: string) => void }) {
  if (apiKey) return true;
  t.skip("NOT RUN - MISSING OPENAI_API_KEY");
  return false;
}

test("VOICE_AGENT_CREATE_SETTINGS defaults to French for German", () => {
  const settings = VOICE_AGENT_CREATE_SETTINGS("french_for_german");
  assert.equal(settings.topicId, "french_for_german");
  assert.equal(settings.languageName, "French");
  assert.match(settings.topic, /French/i);
});

test("VOICE_AGENT_TEXT_CHAT returns standard error for missing typed text", async () => {
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "",
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.method, "VOICE_AGENT_TEXT_CHAT");
  assert.equal(result.status.ok, false);
  assert.equal(result.status.phase, "error");
  assert.match(result.status.error || "", /requires textUserChat/i);
  assert.equal(result.json.chat_text_to_user, result.status.error);
});

test("VOICE_AGENT_TEXT_CHAT returns standard error for missing OpenAI config", async () => {
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(
    { ...serverConfig(), openAiApiKey: "" },
    {
      textUserChat: "Bonjour",
      settings: VOICE_AGENT_DEFAULT_SETTINGS
    }
  );

  assert.equal(result.status.method, "VOICE_AGENT_TEXT_CHAT");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /OPENAI_API_KEY|configured|required/i);
});

test("VOICE_AGENT_TEXT_CHAT real OpenAI call returns a chat answer, not fallback text", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "Bonjour, je veux pratiquer le francais.",
    history5LastTextChats: ["assistant: French practice is ready."],
    speakEnabled: false,
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.method, "VOICE_AGENT_TEXT_CHAT");
  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.audio, null);
  assert.ok(result.json.chat_text_to_user.trim().length > 0);
  assert.doesNotMatch(result.json.chat_text_to_user, /^I can help with this French sentence:/);
  assert.match(result.debug.rawAiText, /\{/);
  assert.equal(result.debug.input.settings.topicId, "french_for_german");
});

test("VOICE_AGENT_TEXT_CHAT real OpenAI call can flag a forced grammar correction", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "Je suis aller au magasin hier.",
    additionalInstructions: "For this test, this sentence has a French grammar mistake. Set has_corrections true, correction_type grammar, and provide text_corrected.",
    speakEnabled: false,
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.json.flags.has_corrections, true);
  assert.equal(result.json.flags.correction_type, "grammar");
  assert.ok(result.json.text_corrected.trim().length > 0);
  assert.ok(result.json.chat_text_to_user.trim().length > 0);
});

test("VOICE_AGENT_TEXT_CHAT real OpenAI call answers latest message, not old history", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "Bonjour.",
    history5LastTextChats: [
      "user: Explain the French Revolution in detail.",
      "user: Je suis aller au magasin hier."
    ],
    additionalInstructions: "For this test, answer only the latest textUserChat. Do not mention revolution, history, magasin, or magasin sentence unless the latest message asks about it.",
    speakEnabled: false,
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.ok(result.json.chat_text_to_user.trim().length > 0);
  assert.doesNotMatch(result.json.chat_text_to_user.toLowerCase(), /revolution|history|magasin/);
});

test("VOICE_AGENT_TEXT_CHAT real OpenAI call detects exact off keyword in text", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const settings: VoiceAgentSettings = {
    ...VOICE_AGENT_DEFAULT_SETTINGS,
    keywordOn: "computer",
    keywordOff: "computer off"
  };
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "computer off",
    additionalInstructions: "For this test, detect exact keyword fields according to the configured keyword phrases.",
    speakEnabled: false,
    settings
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.json.flags.keyword_off_sent, true);
  assert.equal(result.json.flags.keyword_detected, "off");
});

function loadLocalEnv() {
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
}
