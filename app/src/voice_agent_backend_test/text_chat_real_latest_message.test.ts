import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

test("VOICE_AGENT_TEXT_CHAT real OpenAI call answers latest message, not old history", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "Je suis aller au magasin hier.",
    history5LastTextChats: [
      "user: Explain the French Revolution in detail.",
      "user: Bonjour."
    ],
    additionalInstructions: "For this test, correct only the latest textUserChat. Do not mention revolution, history, or Bonjour.",
    speakEnabled: false,
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.json.flags.has_corrections, true);
  assert.ok(result.json.chat_text_to_user.trim().length > 0);
  assert.doesNotMatch(result.json.chat_text_to_user.toLowerCase(), /revolution|history|bonjour/);
  assert.equal(result.audio, null);
});
