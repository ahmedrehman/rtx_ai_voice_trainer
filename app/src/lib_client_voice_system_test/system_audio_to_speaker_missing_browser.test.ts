import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_AUDIO_TO_SPEAKER } from "../lib_client_voice_system";

test("SYSTEM_AUDIO_TO_SPEAKER returns status error when browser playback API is unavailable", async () => {
  const result = await SYSTEM_AUDIO_TO_SPEAKER({}, { audio: new Blob(["x"], { type: "audio/wav" }) });

  assert.equal(result.status.method, "SYSTEM_AUDIO_TO_SPEAKER");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /speaker playback API not available/i);
  assert.equal(result.played, false);
});
