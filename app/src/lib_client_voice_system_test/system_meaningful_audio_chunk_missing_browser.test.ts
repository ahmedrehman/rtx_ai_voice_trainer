import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_MEANINGFUL_AUDIO_CHUNK } from "../lib_client_voice_system";

test("SYSTEM_MEANINGFUL_AUDIO_CHUNK returns status error when browser microphone API is unavailable", async () => {
  const result = await SYSTEM_MEANINGFUL_AUDIO_CHUNK({}, {
    maxDurationMs: 10,
    chunkDecisionMode: "auto",
    energyThreshold: 0.035,
    minEnergyActiveMs: 250
  });

  assert.equal(result.status.method, "SYSTEM_MEANINGFUL_AUDIO_CHUNK");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /microphone API not available/i);
  assert.equal(result.audio, null);
  assert.equal(result.energyCheck.available, false);
  assert.equal(result.energyCheck.hasSound, false);
});
