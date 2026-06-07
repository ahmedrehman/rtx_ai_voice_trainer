import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_MICRO_TO_AUDIO } from "../lib_client_voice_system";
import { createClientVoiceLogger } from "./test_env";

test("SYSTEM_MICRO_TO_AUDIO returns status error when browser microphone API is unavailable", async () => {
  const log = createClientVoiceLogger();
  const result = await SYSTEM_MICRO_TO_AUDIO({ logger: log.logger }, { durationMs: 10 });

  assert.equal(result.status.method, "SYSTEM_MICRO_TO_AUDIO");
  assert.equal(result.status.ok, false);
  assert.match(result.status.error || "", /microphone API not available/i);
  assert.equal(result.audio, null);
  assert.ok(log.events.some((event) => event.message === "start"));
  assert.ok(log.events.some((event) => event.level === "error"));
});
