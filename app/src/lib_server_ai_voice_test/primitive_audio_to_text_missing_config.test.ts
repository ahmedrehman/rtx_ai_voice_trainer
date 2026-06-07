import assert from "node:assert/strict";
import test from "node:test";
import { PRIMITIVE_AUDIO_TO_TEXT } from "../lib_server_ai_voice";
import { sampleAudioFormData, serverAiConfig } from "./test_env";

test("PRIMITIVE_AUDIO_TO_TEXT returns status error for missing OpenAI config", async () => {
  const result = await PRIMITIVE_AUDIO_TO_TEXT(
    serverAiConfig({ implementation: "openai-transcribe", openAiApiKey: "" }),
    {
      provider: "openai",
      audioBody: sampleAudioFormData(),
      audioContentType: undefined,
      history: []
    }
  );

  assert.equal(result.status.method, "PRIMITIVE_AUDIO_TO_TEXT");
  assert.equal(result.status.ok, false);
  assert.equal(result.status.phase, "error");
  assert.match(result.status.error || "", /OPENAI_API_KEY|configured|required/i);
});
