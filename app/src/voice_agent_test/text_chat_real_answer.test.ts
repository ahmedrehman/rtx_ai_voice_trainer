import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

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
