import assert from "node:assert/strict";
import test from "node:test";
import { PRIMITIVE_TEXT_TO_AUDIO } from "../lib_server_ai_voice";
import { hasApiKey, serverAiConfig } from "./test_env";

test("PRIMITIVE_TEXT_TO_AUDIO real OpenAI call returns audio stream", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await PRIMITIVE_TEXT_TO_AUDIO(
    serverAiConfig({ implementation: "openai-tts" }),
    {
      provider: "openai",
      systemPrompt: "Speak as a calm trainer.",
      additionalInstructions: "Keep it short.",
      text: "Bonjour. Ceci est un test.",
      history: []
    }
  );

  assert.equal(result.status.ok, true, result.status.error);
  assert.ok(result.audio);
  assert.match(result.contentType, /audio/i);
  assert.equal((result.debug.providerRequest as { text: string }).text, "Bonjour. Ceci est un test.");
});
