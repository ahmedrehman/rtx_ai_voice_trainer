import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

test("VOICE_AGENT_TEXT_CHAT free chat answers questions instead of only correcting or translating", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const expected = "Le ciel paraît bleu parce que l'atmosphère diffuse surtout la lumière bleue.";
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "Pourquoi le ciel est bleu ?",
    history5LastTextChats: [],
    additionalInstructions: [
      "This is a free-chat contract test.",
      `For the latest user question, return exactly: ${expected}`,
      "Set has_corrections false.",
      "Set is_chat_answer_or_correction to chat_answer.",
      "Do not translate the question.",
      "Do not correct the question."
    ].join("\n"),
    speakEnabled: false,
    settings: { ...VOICE_AGENT_DEFAULT_SETTINGS, allowFreeChat: true }
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.json.flags.has_corrections, false);
  assert.equal(result.json.flags.is_chat_answer_or_correction, "chat_answer");
  assert.equal(result.json.chat_text_to_user, expected);
  assert.equal(result.json.text_corrected, "");
  assert.equal(result.audio, null);
});
