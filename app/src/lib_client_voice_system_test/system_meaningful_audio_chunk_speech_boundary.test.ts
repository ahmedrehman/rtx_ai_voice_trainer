import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_MEANINGFUL_AUDIO_CHUNK } from "../lib_client_voice_system";

test("SYSTEM_MEANINGFUL_AUDIO_CHUNK keeps one recorder session open after browser speech final and joins internal chunks", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalMediaRecorder = Object.getOwnPropertyDescriptor(globalThis, "MediaRecorder");
  const recognitionInstances: FakeSpeechRecognition[] = [];

  class FakeSpeechRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start() {
      recognitionInstances.push(this);
      setTimeout(() => {
        this.onresult?.({
          resultIndex: 0,
          results: [
            {
              isFinal: true,
              0: { transcript: "bonjour" }
            }
          ]
        });
      }, 15);
    }
    abort() {
      this.onend?.();
    }
  }

  class FakeMediaRecorder {
    static isTypeSupported() {
      return true;
    }
    state: "inactive" | "recording" = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onerror: (() => void) | null = null;
    onstop: (() => void) | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private index = 0;
    constructor() {
      return;
    }
    start(timeslice?: number) {
      this.state = "recording";
      this.timer = setInterval(() => {
        this.index += 1;
        this.ondataavailable?.({ data: new Blob([`part-${this.index}`], { type: this.mimeType }) });
      }, timeslice || 20);
    }
    stop() {
      if (this.state !== "recording") return;
      this.state = "inactive";
      if (this.timer) clearInterval(this.timer);
      this.onstop?.();
    }
  }

  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
      SpeechRecognition: FakeSpeechRecognition,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      isSecureContext: true
      }
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }]
        })
      }
      }
    });
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder
    });

    const result = await SYSTEM_MEANINGFUL_AUDIO_CHUNK({}, {
      maxDurationMs: 500,
      silenceMs: 220,
      mediaChunkMs: 100,
      speechCheckLang: "fr-FR",
      chunkDecisionMode: "browser_speech_text"
    });

    assert.equal(result.status.ok, true, result.status.error);
    assert.equal(result.chunkReason, "browser_speech_final");
    assert.equal(result.browserSpeechText, "bonjour");
    assert.equal(result.browserSpeechFinalDetected, true);
    assert.equal(result.mediaChunkMs, 100);
    assert.ok(result.mediaChunkCount >= 2, `expected several internal chunks, got ${result.mediaChunkCount}`);
    assert.ok(result.audio);
    assert.equal(recognitionInstances[0]?.continuous, true);
  } finally {
    restoreGlobalProperty("window", originalWindow);
    restoreGlobalProperty("navigator", originalNavigator);
    restoreGlobalProperty("MediaRecorder", originalMediaRecorder);
  }
});

function restoreGlobalProperty(key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(globalThis, key, descriptor);
    return;
  }
  delete (globalThis as unknown as Record<string, unknown>)[key];
}
