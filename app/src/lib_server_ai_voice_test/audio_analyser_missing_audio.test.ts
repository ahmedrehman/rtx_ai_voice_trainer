import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_ANALYSER, AUDIO_ANALYSER_DEFAULT_PROMPTS } from "../lib_server_ai_voice";
import { serverAiConfig } from "./test_env";

test("AUDIO_ANALYSER returns status error for missing original audio", async () => {
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
      textUserChat: "Bonjour",
      audioUserAudio: { audioBase64: "", audioFormat: "wav" },
      history5LastTextChats: [],
      voice: "coral"
    }
  );

  assert.equal(result.status.method, "AUDIO_ANALYSER");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /requires original microphone audio/i);
});
