import assert from "node:assert/strict";
import test from "node:test";
import { PRIMITIVE_AUDIO_TO_TEXT } from "../lib_server_ai_voice";
import { hasApiKey, sampleAudioFormData, serverAiConfig } from "./test_env";

test("PRIMITIVE_AUDIO_TO_TEXT real OpenAI call returns transcript text", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await PRIMITIVE_AUDIO_TO_TEXT(
    serverAiConfig({ implementation: "openai-transcribe" }),
    {
      provider: "openai",
      audioBody: sampleAudioFormData(),
      audioContentType: undefined,
      textChat: "Bonjour",
      history: []
    }
  );

  assert.equal(result.status.ok, true, result.status.error);
  assert.ok(result.json.text.trim().length > 0);
  assert.match(result.json.hint, /transcription|pronunciation/i);
});
