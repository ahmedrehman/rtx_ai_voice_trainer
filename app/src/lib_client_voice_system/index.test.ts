import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_AUDIO_ENERGY_CHECK,
  SYSTEM_AUDIO_TO_SPEAKER,
  SYSTEM_AUDIO_TO_TEXT,
  SYSTEM_MEANINGFUL_AUDIO_CHUNK,
  SYSTEM_MICRO_TO_AUDIO,
  SYSTEM_TEXT_TO_AUDIO
} from "./index";

const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;
const originalMediaRecorder = globalThis.MediaRecorder;
const originalAudio = globalThis.Audio;
const originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;
const originalUrlCreateObjectUrl = URL.createObjectURL;
const originalUrlRevokeObjectUrl = URL.revokeObjectURL;

let audioShouldFail = false;
let speechShouldFail = false;
let recognitionShouldError = false;

beforeEach(() => {
  audioShouldFail = false;
  speechShouldFail = false;
  recognitionShouldError = false;
  installBrowserMocks();
});

afterEach(() => {
  restoreBrowserMocks();
});

describe("SYSTEM_MICRO_TO_AUDIO", () => {
  it("records microphone audio with audio-only media request", async () => {
    const output = await SYSTEM_MICRO_TO_AUDIO({}, { durationMs: 5, mimeType: "audio/webm" });

    assert.equal(output.status.ok, true);
    assert.equal(output.mimeType, "audio/webm");
    assert.equal(output.audio instanceof Blob, true);
    assert.equal(output.audio?.size, 10);
    assert.deepEqual((globalThis.navigator.mediaDevices.getUserMedia as MockGetUserMedia).lastConstraints, { audio: true, video: false });
  });

  it("returns error status when microphone API is unavailable", async () => {
    installNavigator(undefined);

    const output = await SYSTEM_MICRO_TO_AUDIO({}, { durationMs: 5 });

    assert.equal(output.status.ok, false);
    assert.match(output.status.error || "", /microphone API not available/);
    assert.equal(output.audio, null);
  });
});

describe("SYSTEM_MEANINGFUL_AUDIO_CHUNK", () => {
  it("records a chunk and ends by max duration when no speech checker exists", async () => {
    delete globalThis.window.SpeechRecognition;
    delete globalThis.window.webkitSpeechRecognition;

    const output = await SYSTEM_MEANINGFUL_AUDIO_CHUNK({}, { maxDurationMs: 5, mimeType: "audio/webm" });

    assert.equal(output.status.ok, true);
    assert.equal(output.chunkReason, "no_speech_checker");
    assert.equal(output.audio instanceof Blob, true);
    assert.equal(output.energyCheck.implemented, true);
  });

  it("returns error status when MediaRecorder is unavailable", async () => {
    Reflect.deleteProperty(globalThis, "MediaRecorder");

    const output = await SYSTEM_MEANINGFUL_AUDIO_CHUNK({}, { maxDurationMs: 5 });

    assert.equal(output.status.ok, false);
    assert.match(output.status.error || "", /MediaRecorder API not available/);
    assert.equal(output.audio, null);
  });
});

describe("SYSTEM_AUDIO_ENERGY_CHECK", () => {
  it("detects sound when RMS crosses the threshold long enough", async () => {
    installAudioContextMock(255);
    globalThis.window.setInterval = ((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
        callback();
        callback();
      }
      return 1;
    }) as typeof setInterval;
    globalThis.window.clearInterval = (() => undefined) as typeof clearInterval;
    const controller = SYSTEM_AUDIO_ENERGY_CHECK({}, { stream: fakeStream(), threshold: 0.01, minActiveMs: 10, sampleEveryMs: 5 });

    controller.start();
    controller.stop();
    const summary = controller.summary();

    assert.equal(summary.available, true);
    assert.equal(summary.hasSound, true);
    assert.ok(summary.activeMs >= 10);
    assert.ok(summary.sampleCount > 0);
  });

  it("reports unavailable when AudioContext is missing", () => {
    Reflect.deleteProperty(globalThis.window, "AudioContext");
    Reflect.deleteProperty(globalThis.window, "webkitAudioContext");

    const controller = SYSTEM_AUDIO_ENERGY_CHECK({}, { stream: fakeStream() });
    controller.start();
    controller.stop();
    const summary = controller.summary();

    assert.equal(summary.available, false);
    assert.equal(summary.hasSound, false);
  });
});

describe("SYSTEM_AUDIO_TO_SPEAKER", () => {
  it("plays audio through browser speaker API", async () => {
    const output = await SYSTEM_AUDIO_TO_SPEAKER({}, { audio: new Blob(["audio"], { type: "audio/wav" }) });

    assert.equal(output.status.ok, true);
    assert.equal(output.played, true);
  });

  it("returns error status when playback fails", async () => {
    audioShouldFail = true;

    const output = await SYSTEM_AUDIO_TO_SPEAKER({}, { audio: new Blob(["audio"], { type: "audio/wav" }) });

    assert.equal(output.status.ok, false);
    assert.equal(output.played, false);
    assert.match(output.status.error || "", /playback failed/);
  });
});

describe("SYSTEM_TEXT_TO_AUDIO", () => {
  it("speaks text with browser dummy speech synthesis", async () => {
    const output = await SYSTEM_TEXT_TO_AUDIO({}, { text: "Bonjour", lang: "fr-FR" });

    assert.equal(output.status.ok, true);
    assert.equal(output.spoken, true);
    assert.equal(output.note, "browser_dummy_text_to_speech_only");
  });

  it("returns error status when browser speech synthesis fails", async () => {
    speechShouldFail = true;

    const output = await SYSTEM_TEXT_TO_AUDIO({}, { text: "Bonjour" });

    assert.equal(output.status.ok, false);
    assert.equal(output.spoken, false);
  });
});

describe("SYSTEM_AUDIO_TO_TEXT", () => {
  it("returns browser speech-recognition text", async () => {
    const output = await SYSTEM_AUDIO_TO_TEXT({}, { lang: "fr-FR", timeoutMs: 50 });

    assert.equal(output.status.ok, true);
    assert.equal(output.text, "bonjour test");
    assert.equal(output.note, "browser_speech_recognition_only");
  });

  it("returns error status when speech recognition is unavailable", async () => {
    delete globalThis.window.SpeechRecognition;
    delete globalThis.window.webkitSpeechRecognition;

    const output = await SYSTEM_AUDIO_TO_TEXT({}, { timeoutMs: 5 });

    assert.equal(output.status.ok, false);
    assert.match(output.status.error || "", /speech recognition not available/);
    assert.equal(output.text, "");
  });
});

function installBrowserMocks() {
  const windowMock = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    SpeechRecognition: MockSpeechRecognition,
    webkitSpeechRecognition: MockSpeechRecognition
  };
  Object.defineProperty(globalThis, "window", { value: windowMock, configurable: true, writable: true });
  installNavigator(mockGetUserMedia);
  Object.defineProperty(globalThis, "MediaRecorder", { value: MockMediaRecorder, configurable: true, writable: true });
  Object.defineProperty(globalThis, "Audio", { value: MockAudio, configurable: true, writable: true });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: MockSpeechSynthesisUtterance, configurable: true, writable: true });
  URL.createObjectURL = () => "blob:unit-test";
  URL.revokeObjectURL = () => undefined;
  globalThis.window.speechSynthesis = {
    speak(utterance: SpeechSynthesisUtterance) {
      const mockUtterance = utterance as unknown as MockSpeechSynthesisUtterance;
      setTimeout(() => {
        if (speechShouldFail) mockUtterance.onerror?.({ error: "failed" });
        else mockUtterance.onend?.();
      }, 0);
    }
  } as SpeechSynthesis;
}

function restoreBrowserMocks() {
  Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true, writable: true });
  Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true, writable: true });
  if (originalMediaRecorder) Object.defineProperty(globalThis, "MediaRecorder", { value: originalMediaRecorder, configurable: true, writable: true });
  else Reflect.deleteProperty(globalThis, "MediaRecorder");
  if (originalAudio) Object.defineProperty(globalThis, "Audio", { value: originalAudio, configurable: true, writable: true });
  else Reflect.deleteProperty(globalThis, "Audio");
  if (originalSpeechSynthesisUtterance) Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { value: originalSpeechSynthesisUtterance, configurable: true, writable: true });
  else Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  URL.createObjectURL = originalUrlCreateObjectUrl;
  URL.revokeObjectURL = originalUrlRevokeObjectUrl;
}

type MockGetUserMedia = ((constraints: MediaStreamConstraints) => Promise<MediaStream>) & { lastConstraints?: MediaStreamConstraints };

const mockGetUserMedia: MockGetUserMedia = async (constraints) => {
  mockGetUserMedia.lastConstraints = constraints;
  return fakeStream();
};

function installNavigator(getUserMedia: MockGetUserMedia | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: { mediaDevices: getUserMedia ? { getUserMedia } : undefined },
    configurable: true,
    writable: true
  });
}

function fakeStream(): MediaStream {
  return {
    getTracks() {
      return [{ stop() { undefined; } }];
    }
  } as unknown as MediaStream;
}

class MockMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  mimeType: string;
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || "audio/webm";
  }

  start() {
    this.state = "recording";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["audio data"], { type: this.mimeType }) } as BlobEvent);
    }, 0);
  }

  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    setTimeout(() => this.onstop?.(), 0);
  }
}

class MockAudio {
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_url: string) {}

  async play() {
    if (audioShouldFail) throw new Error("playback failed");
    setTimeout(() => this.onended?.(), 0);
  }
}

class MockSpeechSynthesisUtterance {
  lang = "";
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(public text: string) {}
}

class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    setTimeout(() => {
      if (recognitionShouldError) {
        this.onerror?.({ error: "failed" });
        return;
      }
      this.onresult?.({
        resultIndex: 0,
        results: [{
          isFinal: true,
          0: { transcript: "bonjour test" }
        }]
      });
    }, 0);
  }

  abort() {
    undefined;
  }
}

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function installAudioContextMock(sampleValue: number) {
  class MockAudioContext {
    createMediaStreamSource() {
      return { connect() { undefined; } };
    }

    createAnalyser() {
      return {
        fftSize: 8,
        getByteTimeDomainData(samples: Uint8Array) {
          samples.fill(sampleValue);
        }
      };
    }

    async close() {
      undefined;
    }
  }

  globalThis.window.AudioContext = MockAudioContext as unknown as typeof AudioContext;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
