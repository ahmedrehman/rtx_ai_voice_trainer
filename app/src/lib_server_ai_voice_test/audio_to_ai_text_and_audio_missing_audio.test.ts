import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_TO_AI_TEXT_AND_AUDIO } from "../lib_server_ai_voice";
import { serverAiConfig } from "./test_env";

test("AUDIO_TO_AI_TEXT_AND_AUDIO returns status error for missing audio", async () => {
  const result = await AUDIO_TO_AI_TEXT_AND_AUDIO(
    serverAiConfig({ implementation: "openai-audio" }),
    {
      provider: "openai",
      audioBase64: "",
      audioFormat: "wav",
      systemPrompt: "You are a short voice trainer.",
      taskPrompt: "Listen and answer shortly.",
      responseJsonFormat: "{ \"chat_text_to_user\": \"\" }"
    }
  );

  assert.equal(result.status.method, "AUDIO_TO_AI_TEXT_AND_AUDIO");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /Audio AI input is empty|requires/i);
});
