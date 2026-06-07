import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS, type VoiceAgentSettings } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

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
