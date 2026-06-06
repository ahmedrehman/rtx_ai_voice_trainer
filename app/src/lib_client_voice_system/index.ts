export type ClientVoiceLogEvent = {
  level: "info" | "error";
  method: string;
  message: string;
  data?: unknown;
  createdAt: string;
};

export type ClientVoiceLogger = (event: ClientVoiceLogEvent) => void;

export type ClientVoiceConfig = {
  logger?: ClientVoiceLogger;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

export type MethodStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type SystemMicroToAudioInput = {
  durationMs: number;
  mimeType?: string;
};

export type SystemMeaningfulAudioChunkInput = {
  maxDurationMs: number;
  silenceMs?: number;
  speechCheckLang?: string;
  mimeType?: string;
};

export type SystemMicroToAudioOutput = {
  status: MethodStatus;
  audio: Blob | null;
  mimeType: string;
  durationMs: number;
};

export type SystemMeaningfulAudioChunkOutput = {
  status: MethodStatus;
  audio: Blob | null;
  mimeType: string;
  durationMs: number;
  chunkReason: "browser_speech_final" | "silence_after_sound" | "max_duration" | "no_speech_checker";
  browserSpeechText?: string;
};

export type SystemAudioToSpeakerInput = {
  audio: Blob;
};

export type SystemAudioToSpeakerOutput = {
  status: MethodStatus;
  played: boolean;
};

export type SystemTextToAudioInput = {
  text: string;
  lang?: string;
};

export type SystemTextToAudioOutput = {
  status: MethodStatus;
  spoken: boolean;
  note: "browser_dummy_text_to_speech_only";
};

export type SystemAudioToTextInput = {
  lang?: string;
};

export type SystemAudioToTextOutput = {
  status: MethodStatus;
  text: string;
  note: "browser_speech_recognition_only";
};

export async function SYSTEM_MICRO_TO_AUDIO(config: ClientVoiceConfig, input: SystemMicroToAudioInput): Promise<SystemMicroToAudioOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "SYSTEM_MICRO_TO_AUDIO", "start", input);
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("client microphone API not available");
    log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error.message);
    return { status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0 };
  }
  if (typeof MediaRecorder === "undefined") {
    const error = new Error("client MediaRecorder API not available");
    log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error.message);
    return { status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0 };
  }
  if (input.mimeType && typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(input.mimeType)) {
    const error = new Error(`client MediaRecorder MIME type not supported: ${input.mimeType}`);
    log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error.message);
    return { status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: input.mimeType, durationMs: 0 };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (error) {
    log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error instanceof Error ? error.message : "microphone permission failed");
    return { status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0 };
  }

  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, input.mimeType ? { mimeType: input.mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error instanceof Error ? error.message : "MediaRecorder creation failed");
    return { status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0 };
  }

  return new Promise((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      const error = new Error("client audio recording failed");
      log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error.message);
      resolve({ status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: recorder.mimeType || input.mimeType || "", durationMs: Date.now() - Date.parse(startedAt) });
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const mimeType = recorder.mimeType || input.mimeType || "audio/webm";
      const audio = new Blob(chunks, { type: mimeType });
      const output = { status: doneStatus("SYSTEM_MICRO_TO_AUDIO", startedAt), audio, mimeType, durationMs: input.durationMs };
      log(config, "info", "SYSTEM_MICRO_TO_AUDIO", "done", { size: audio.size, mimeType });
      resolve(output);
    };

    try {
      recorder.start();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      log(config, "error", "SYSTEM_MICRO_TO_AUDIO", error instanceof Error ? error.message : "recording start failed");
      resolve({ status: errorStatus("SYSTEM_MICRO_TO_AUDIO", startedAt, error), audio: null, mimeType: recorder.mimeType || input.mimeType || "", durationMs: 0 });
      return;
    }
    window.setTimeout(() => recorder.state === "recording" && recorder.stop(), input.durationMs);
  });
}

export async function SYSTEM_MEANINGFUL_AUDIO_CHUNK(config: ClientVoiceConfig, input: SystemMeaningfulAudioChunkInput): Promise<SystemMeaningfulAudioChunkOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", "start", input);
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("client microphone API not available");
    log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error.message);
    return { status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0, chunkReason: "no_speech_checker" };
  }
  if (typeof MediaRecorder === "undefined") {
    const error = new Error("client MediaRecorder API not available");
    log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error.message);
    return { status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0, chunkReason: "no_speech_checker" };
  }
  if (input.mimeType && typeof MediaRecorder.isTypeSupported === "function" && !MediaRecorder.isTypeSupported(input.mimeType)) {
    const error = new Error(`client MediaRecorder MIME type not supported: ${input.mimeType}`);
    log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error.message);
    return { status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: input.mimeType, durationMs: 0, chunkReason: "no_speech_checker" };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (error) {
    log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error instanceof Error ? error.message : "microphone permission failed");
    return { status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0, chunkReason: "no_speech_checker" };
  }

  const chunks: Blob[] = [];
  const startedMs = Date.now();
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, input.mimeType ? { mimeType: input.mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error instanceof Error ? error.message : "MediaRecorder creation failed");
    return { status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: input.mimeType || "", durationMs: 0, chunkReason: "no_speech_checker" };
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition: BrowserSpeechRecognition | null = null;
  let browserSpeechText = "";
  let stopReason: SystemMeaningfulAudioChunkOutput["chunkReason"] = Recognition ? "max_duration" : "no_speech_checker";
  let finished = false;
  let silenceTimer: number | undefined;
  let maxTimer: number | undefined;

  function stop(reason: SystemMeaningfulAudioChunkOutput["chunkReason"]) {
    if (finished) return;
    finished = true;
    stopReason = reason;
    if (silenceTimer) window.clearTimeout(silenceTimer);
    if (maxTimer) window.clearTimeout(maxTimer);
    recognition?.abort();
    if (recorder.state === "recording") recorder.stop();
  }

  return new Promise((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      const error = new Error("client chunk recording failed");
      log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error.message);
      resolve({ status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: recorder.mimeType || input.mimeType || "", durationMs: Date.now() - startedMs, chunkReason: stopReason, browserSpeechText });
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const mimeType = recorder.mimeType || input.mimeType || "audio/webm";
      const audio = new Blob(chunks, { type: mimeType });
      const output = {
        status: doneStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt),
        audio,
        mimeType,
        durationMs: Date.now() - startedMs,
        chunkReason: stopReason,
        browserSpeechText
      };
      log(config, "info", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", "done", {
        size: audio.size,
        mimeType,
        chunkReason: stopReason,
        browserSpeechText
      });
      resolve(output);
    };

    try {
      recorder.start(250);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error instanceof Error ? error.message : "recording start failed");
      resolve({ status: errorStatus("SYSTEM_MEANINGFUL_AUDIO_CHUNK", startedAt, error), audio: null, mimeType: recorder.mimeType || input.mimeType || "", durationMs: Date.now() - startedMs, chunkReason: stopReason, browserSpeechText });
      return;
    }
    maxTimer = window.setTimeout(() => stop(Recognition ? "max_duration" : "no_speech_checker"), input.maxDurationMs);

    if (Recognition) {
      try {
        const recognitionInstance = new Recognition();
        recognition = recognitionInstance;
        recognitionInstance.lang = input.speechCheckLang || "fr-FR";
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.onresult = (event: BrowserSpeechRecognitionEvent) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            browserSpeechText += event.results[index][0].transcript;
            if (event.results[index].isFinal) stop("browser_speech_final");
          }
          if (silenceTimer) window.clearTimeout(silenceTimer);
          silenceTimer = window.setTimeout(() => stop("silence_after_sound"), input.silenceMs || 900);
        };
        recognitionInstance.onerror = (event: { error: string }) => {
          log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", `browser speech checker failed: ${event.error}`);
        };
        recognitionInstance.start();
      } catch (error) {
        log(config, "error", "SYSTEM_MEANINGFUL_AUDIO_CHUNK", error instanceof Error ? error.message : "browser speech checker start failed");
      }
    }
  });
}

export async function SYSTEM_AUDIO_TO_SPEAKER(config: ClientVoiceConfig, input: SystemAudioToSpeakerInput): Promise<SystemAudioToSpeakerOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "SYSTEM_AUDIO_TO_SPEAKER", "start", { size: input.audio.size, type: input.audio.type });
  const url = URL.createObjectURL(input.audio);
  const audio = new Audio(url);

  return new Promise((resolve) => {
    audio.onended = () => {
      URL.revokeObjectURL(url);
      log(config, "info", "SYSTEM_AUDIO_TO_SPEAKER", "done");
      resolve({ status: doneStatus("SYSTEM_AUDIO_TO_SPEAKER", startedAt), played: true });
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      const error = new Error("client speaker playback failed");
      log(config, "error", "SYSTEM_AUDIO_TO_SPEAKER", error.message);
      resolve({ status: errorStatus("SYSTEM_AUDIO_TO_SPEAKER", startedAt, error), played: false });
    };
    void audio.play().catch((error) => {
      URL.revokeObjectURL(url);
      log(config, "error", "SYSTEM_AUDIO_TO_SPEAKER", error instanceof Error ? error.message : "playback failed");
      resolve({ status: errorStatus("SYSTEM_AUDIO_TO_SPEAKER", startedAt, error), played: false });
    });
  });
}

export async function SYSTEM_TEXT_TO_AUDIO(config: ClientVoiceConfig, input: SystemTextToAudioInput): Promise<SystemTextToAudioOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "SYSTEM_TEXT_TO_AUDIO", "start", { note: "browser dummy only" });
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    const error = new Error("client browser text-to-speech not available");
    log(config, "error", "SYSTEM_TEXT_TO_AUDIO", error.message);
    return { status: errorStatus("SYSTEM_TEXT_TO_AUDIO", startedAt, error), spoken: false, note: "browser_dummy_text_to_speech_only" };
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(input.text);
    utterance.lang = input.lang || "fr-FR";
    utterance.onend = () => resolve({ status: doneStatus("SYSTEM_TEXT_TO_AUDIO", startedAt), spoken: true, note: "browser_dummy_text_to_speech_only" });
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      const error = new Error("client browser text-to-speech failed");
      log(config, "error", "SYSTEM_TEXT_TO_AUDIO", `${error.message}: ${event.error}`);
      resolve({ status: errorStatus("SYSTEM_TEXT_TO_AUDIO", startedAt, error), spoken: false, note: "browser_dummy_text_to_speech_only" });
    };
    window.speechSynthesis.speak(utterance);
  });
}

export async function SYSTEM_AUDIO_TO_TEXT(config: ClientVoiceConfig, input: SystemAudioToTextInput = {}): Promise<SystemAudioToTextOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "SYSTEM_AUDIO_TO_TEXT", "start", { note: "browser speech recognition only" });
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    const error = new Error("client browser speech recognition not available");
    log(config, "error", "SYSTEM_AUDIO_TO_TEXT", error.message);
    return { status: errorStatus("SYSTEM_AUDIO_TO_TEXT", startedAt, error), text: "", note: "browser_speech_recognition_only" };
  }

  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = input.lang || "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      let text = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        text += event.results[index][0].transcript;
      }
      resolve({ status: doneStatus("SYSTEM_AUDIO_TO_TEXT", startedAt), text: text.trim(), note: "browser_speech_recognition_only" });
    };
    recognition.onerror = (event: { error: string }) => {
      const error = new Error(`client browser speech recognition failed: ${event.error}`);
      log(config, "error", "SYSTEM_AUDIO_TO_TEXT", error.message);
      resolve({ status: errorStatus("SYSTEM_AUDIO_TO_TEXT", startedAt, error), text: "", note: "browser_speech_recognition_only" });
    };
    recognition.start();
  });
}

function log(config: ClientVoiceConfig, level: "info" | "error", method: string, message: string, data?: unknown) {
  config.logger?.({ level, method, message, data, createdAt: new Date().toISOString() });
}

function doneStatus(method: string, startedAt: string): MethodStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorStatus(method: string, startedAt: string, error: unknown): MethodStatus {
  return {
    method,
    ok: false,
    phase: "error",
    startedAt,
    finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  };
}
