import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

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
