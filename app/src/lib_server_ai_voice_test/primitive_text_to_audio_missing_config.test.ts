import assert from "node:assert/strict";
import test from "node:test";
import { PRIMITIVE_TEXT_TO_AUDIO } from "../lib_server_ai_voice";
import { serverAiConfig } from "./test_env";

test("PRIMITIVE_TEXT_TO_AUDIO returns status error for missing OpenAI config", async () => {
  const result = await PRIMITIVE_TEXT_TO_AUDIO(
    serverAiConfig({ implementation: "openai-tts", openAiApiKey: "" }),
    {
      provider: "openai",
      systemPrompt: "Speak as a calm trainer.",
      additionalInstructions: "Keep it short.",
      text: "Bonjour.",
      history: []
    }
  );

  assert.equal(result.status.method, "PRIMITIVE_TEXT_TO_AUDIO");
  assert.equal(result.status.ok, false);
  assert.equal(result.status.phase, "error");
  assert.match(result.status.error || "", /OPENAI_API_KEY|configured|required/i);
  assert.equal(result.audio, null);
});
