import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_TO_AI_TEXT_AND_AUDIO } from "../lib_server_ai_voice";
import { hasApiKey, sampleAudioBase64, serverAiConfig } from "./test_env";

test("AUDIO_TO_AI_TEXT_AND_AUDIO real OpenAI call returns text and audio", { timeout: 180000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await AUDIO_TO_AI_TEXT_AND_AUDIO(
    serverAiConfig({ implementation: "openai-audio" }),
    {
      provider: "openai",
      audioBase64: sampleAudioBase64(),
      audioFormat: "wav",
      systemPrompt: "You are a short voice trainer.",
      taskPrompt: "Listen to the audio and answer with one short sentence.",
      responseJsonFormat: "{ \"chat_text_to_user\": \"\" }",
      voice: "coral"
    }
  );

  assert.equal(result.status.ok, true, result.status.error);
  assert.ok(result.text.trim().length > 0);
  assert.ok(result.audioBase64.length > 0);
  assert.equal(result.audioFormat, "wav");
});
