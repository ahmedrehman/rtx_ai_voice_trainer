import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

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
