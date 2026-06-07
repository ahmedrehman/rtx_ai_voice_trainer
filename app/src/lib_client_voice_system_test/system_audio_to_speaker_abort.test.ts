import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_AUDIO_TO_SPEAKER } from "../lib_client_voice_system";

test("SYSTEM_AUDIO_TO_SPEAKER stops active playback when aborted", async () => {
  const originalAudio = globalThis.Audio;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  let lastAudio: { paused: boolean; currentTime: number } | null = null;

  class FakeAudio {
    paused = false;
    currentTime = 12;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(_url: string) {
      lastAudio = this;
    }

    play() {
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }
  }

  Object.defineProperty(globalThis, "Audio", { value: FakeAudio, configurable: true });
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:test-audio", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });

  try {
    const controller = new AbortController();
    const resultPromise = SYSTEM_AUDIO_TO_SPEAKER({}, {
      audio: new Blob(["x"], { type: "audio/wav" }),
      signal: controller.signal
    });
    controller.abort();
    const result = await resultPromise;

    assert.equal(result.played, false);
    assert.equal(result.stopped, true);
    assert.equal(result.status.ok, false);
    assert.match(result.status.error || "", /stopped/i);
    const playedAudio = lastAudio as { paused: boolean; currentTime: number } | null;
    assert.equal(playedAudio?.paused, true);
    assert.equal(playedAudio?.currentTime, 0);
  } finally {
    Object.defineProperty(globalThis, "Audio", { value: originalAudio, configurable: true });
    Object.defineProperty(URL, "createObjectURL", { value: originalCreateObjectUrl, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: originalRevokeObjectUrl, configurable: true });
  }
});
