import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_AUDIO_TO_TEXT } from "../lib_client_voice_system";

test("SYSTEM_AUDIO_TO_TEXT returns status error when browser SpeechRecognition is unavailable", async () => {
  const result = await SYSTEM_AUDIO_TO_TEXT({}, { lang: "fr-FR", timeoutMs: 10 });

  assert.equal(result.status.method, "SYSTEM_AUDIO_TO_TEXT");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /speech recognition not available/i);
  assert.equal(result.text, "");
  assert.equal(result.note, "browser_speech_recognition_only");
});
