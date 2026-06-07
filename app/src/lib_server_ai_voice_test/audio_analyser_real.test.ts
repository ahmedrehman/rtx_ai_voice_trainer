import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_ANALYSER, AUDIO_ANALYSER_DEFAULT_PROMPTS } from "../lib_server_ai_voice";
import { hasApiKey, sampleAudioBase64, serverAiConfig } from "./test_env";

test("AUDIO_ANALYSER real OpenAI call returns json answer and optional audio", { timeout: 180000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const result = await AUDIO_ANALYSER(
    serverAiConfig({ implementation: "openai-audio" }),
    {
      provider: "openai",
      systemPrompt: {
        systemPrompt: AUDIO_ANALYSER_DEFAULT_PROMPTS.systemPrompt,
        task: AUDIO_ANALYSER_DEFAULT_PROMPTS.task,
        howToRespond: AUDIO_ANALYSER_DEFAULT_PROMPTS.howToRespond,
        responseJsonFormat: AUDIO_ANALYSER_DEFAULT_PROMPTS.responseJsonFormat
      },
      textUserChat: "Bonjour, je veux tester ma voix.",
      audioUserAudio: { audioBase64: sampleAudioBase64(), audioFormat: "wav" },
      history5LastTextChats: [],
      voice: "coral"
    }
  );

  assert.equal(result.status.ok, true, result.status.error);
  assert.ok(result.json.chat_text_to_user.trim().length > 0);
  assert.equal(typeof result.json.flags.has_corrections, "boolean");
  assert.match(result.debug.rawAiText, /\{/);
});
