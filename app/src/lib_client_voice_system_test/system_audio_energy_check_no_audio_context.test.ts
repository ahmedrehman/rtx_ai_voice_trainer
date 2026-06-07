import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_AUDIO_ENERGY_CHECK } from "../lib_client_voice_system";

test("SYSTEM_AUDIO_ENERGY_CHECK reports unavailable when browser AudioContext is unavailable", () => {
  const controller = SYSTEM_AUDIO_ENERGY_CHECK({}, {
    stream: {} as MediaStream,
    threshold: 0.035,
    minActiveMs: 250,
    sampleEveryMs: 10
  });

  controller.start();
  controller.stop();
  const summary = controller.summary();

  assert.equal(summary.implemented, true);
  assert.equal(summary.available, false);
  assert.equal(summary.hasSound, false);
  assert.equal(summary.sampleCount, 0);
});
