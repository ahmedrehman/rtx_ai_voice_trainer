import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_ANALYSER, createAudioAnalyserDefaultPrompts } from "../lib_server_ai_voice";
import { DUMBB_TEXT_TO_SPEACH } from "../mod_ai_calls";
import { hasApiKey, serverAiConfig } from "./test_env";

test("AUDIO_ANALYSER treats spoken keyword as control flag only", { timeout: 180000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const config = serverAiConfig({ implementation: "openai-audio" });
  const prompts = createAudioAnalyserDefaultPrompts({
    languageName: "French",
    topic: "French speaking practice",
    keywordOn: "computer",
    keywordOff: "computer off",
    allowFreeChat: true
  });
  const speech = await DUMBB_TEXT_TO_SPEACH(
    { openAiApiKey: config.openAiApiKey },
    {
      model: config.ttsModel,
      text: "computer",
      voice: config.voice,
      languageName: "English",
      style: "Speak exactly the single English control word: computer."
    }
  );
  const audioBase64 = arrayBufferToBase64(await new Response(speech.body).arrayBuffer());

  const result = await AUDIO_ANALYSER(config, {
    provider: "openai",
    systemPrompt: {
      systemPrompt: prompts.systemPrompt,
      task: prompts.task,
      howToRespond: prompts.howToRespond,
      responseJsonFormat: prompts.responseJsonFormat
    },
    textUserChat: "",
    audioUserAudio: { audioBase64, audioFormat: speech.contentType.includes("wav") ? "wav" : "mp3" },
    history5LastTextChats: [],
    voice: "coral",
    speakEnabled: true
  });

  assert.equal(result.status.ok, true, result.status.error);
  assert.equal(result.json.flags.keyword_on_sent, true);
  assert.equal(result.json.flags.keyword_detected, "on");
  assert.equal(result.json.flags.keyword_exact_text, "computer");
  assert.equal(result.json.flags.has_corrections, false);
  assert.equal(result.json.flags.correction_type, "none");
  assert.equal(result.json.flags.is_chat_answer_or_correction, "none");
  assert.equal(result.json.chat_text_to_user, "");
  assert.equal(result.json.text_corrected, "");
  assert.equal(result.json.hint, "");
  assert.equal(result.audio, null);
  assert.doesNotMatch(result.debug.rawAiText.toLowerCase(), /ordinateur/);
});

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}
