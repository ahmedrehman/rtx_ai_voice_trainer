import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_TEXT_TO_AUDIO } from "../lib_client_voice_system";

test("SYSTEM_TEXT_TO_AUDIO returns status error when browser speech synthesis is unavailable", async () => {
  const result = await SYSTEM_TEXT_TO_AUDIO({}, { text: "Bonjour.", lang: "fr-FR" });

  assert.equal(result.status.method, "SYSTEM_TEXT_TO_AUDIO");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /text-to-speech not available/i);
  assert.equal(result.spoken, false);
  assert.equal(result.note, "browser_dummy_text_to_speech_only");
});
