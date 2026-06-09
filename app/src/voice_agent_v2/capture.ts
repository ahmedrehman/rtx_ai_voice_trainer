export type VoiceAgentV2CaptureStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type VoiceAgentV2MicSession = {
  status: VoiceAgentV2CaptureStatus;
  stream: MediaStream | null;
  debug: {
    constraints: MediaStreamConstraints;
  };
};

export type VoiceAgentV2VoiceSegmentDecision =
  | "send_voice_segment"
  | "skip_no_voice"
  | "skip_too_short"
  | "skip_empty_audio";

export type VoiceAgentV2VoiceSegment = {
  status: VoiceAgentV2CaptureStatus;
  decision: VoiceAgentV2VoiceSegmentDecision;
  audio: Blob | null;
  debug: {
    threshold: number;
    silenceMs: number;
    preBufferMs: number;
    preBufferIncludedMs: number;
    maxWaitMs: number;
    maxRecordMs: number;
    minVoiceMs: number;
    voiceActiveMs: number;
    durationMs: number;
    maxRms: number;
    averageRms: number;
    mimeType: string;
    size: number;
    reason: string;
  };
};

export type VoiceAgentV2MicSample = {
  rms: number;
  voiceDetected: boolean;
};

type BrowserAudioContextConstructor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: BrowserAudioContextConstructor;
  }
}

export async function VOICE_AGENT_V2_OPEN_MICROPHONE(): Promise<VoiceAgentV2MicSession> {
  const startedAt = new Date().toISOString();
  const constraints: MediaStreamConstraints = { audio: true, video: false };
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser microphone API is unavailable.");
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return {
      status: doneStatus("VOICE_AGENT_V2_OPEN_MICROPHONE", startedAt),
      stream,
      debug: { constraints }
    };
  } catch (error) {
    return {
      status: errorStatus("VOICE_AGENT_V2_OPEN_MICROPHONE", startedAt, error),
      stream: null,
      debug: { constraints }
    };
  }
}

export async function VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT(input: {
  stream: MediaStream;
  threshold?: number;
  silenceMs?: number;
  preBufferMs?: number;
  recorderWhileListening?: boolean;
  maxWaitMs?: number;
  maxRecordMs?: number;
  minVoiceMs?: number;
  mimeType?: string;
  onSample?: (sample: VoiceAgentV2MicSample) => void;
  shouldStop?: () => boolean;
}): Promise<VoiceAgentV2VoiceSegment> {
  const startedAt = new Date().toISOString();
  const threshold = input.threshold ?? 0.025;
  const silenceMs = input.silenceMs ?? 650;
  const preBufferMs = Math.max(0, input.preBufferMs ?? 1000);
  const recorderWhileListening = input.recorderWhileListening ?? true;
  const maxWaitMs = input.maxWaitMs ?? 8000;
  const maxRecordMs = input.maxRecordMs ?? 6000;
  const minVoiceMs = input.minVoiceMs ?? 180;
  const sampleEveryMs = 50;
  const startedMs = Date.now();
  let voiceActiveMs = 0;
  let durationMs = 0;
  let maxRms = 0;
  let totalRms = 0;
  let sampleCount = 0;
  let mimeType = input.mimeType || "";
  let size = 0;
  let preBufferIncludedMs = 0;

  try {
    if (typeof MediaRecorder === "undefined") throw new Error("Browser MediaRecorder API is unavailable.");
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Browser AudioContext is unavailable.");
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(input.stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const recorderMimeType = chooseMediaRecorderMimeType(input.mimeType);
    let audio: Blob | null;

    if (!recorderWhileListening) {
      audio = await captureAfterVoiceStart({
        input,
        context,
        source,
        analyser,
        samples,
        recorderMimeType,
        threshold,
        silenceMs,
        maxWaitMs,
        maxRecordMs,
        sampleEveryMs,
        startedMs,
        updateStats: (rms, voiceDetected) => {
          sampleCount += 1;
          totalRms += rms;
          maxRms = Math.max(maxRms, rms);
          if (voiceDetected) voiceActiveMs += sampleEveryMs;
        },
        setMimeType: (value) => {
          mimeType = value;
        },
        setSize: (value) => {
          size = value;
        }
      });
    } else {
      audio = await captureWithPrebuffer({
        input,
        context,
        source,
        analyser,
        samples,
        recorderMimeType,
        threshold,
        silenceMs,
        preBufferMs,
        maxWaitMs,
        maxRecordMs,
        sampleEveryMs,
        startedMs,
        updateStats: (rms, voiceDetected) => {
          sampleCount += 1;
          totalRms += rms;
          maxRms = Math.max(maxRms, rms);
          if (voiceDetected) voiceActiveMs += sampleEveryMs;
        },
        setMimeType: (value) => {
          mimeType = value;
        },
        setSize: (value) => {
          size = value;
        },
        setPreBufferIncludedMs: (value) => {
          preBufferIncludedMs = value;
        }
      });
    }

    durationMs = Date.now() - startedMs;
    if (!audio) {
      return voiceSegmentOutput(startedAt, "skip_no_voice", null, {
        threshold,
        silenceMs,
        preBufferMs,
        preBufferIncludedMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        durationMs,
        maxRms,
        averageRms: averageRms(totalRms, sampleCount),
        mimeType,
        size,
        reason: input.shouldStop?.() ? "Stopped by user before a voice segment was completed." : "No voice crossed the threshold before maxWaitMs."
      });
    }
    if (audio.size <= 0) {
      return voiceSegmentOutput(startedAt, "skip_empty_audio", null, {
        threshold,
        silenceMs,
        preBufferMs,
        preBufferIncludedMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        durationMs,
        maxRms,
        averageRms: averageRms(totalRms, sampleCount),
        mimeType: audio.type,
        size: audio.size,
        reason: "Recorder produced an empty audio blob."
      });
    }
    if (voiceActiveMs < minVoiceMs) {
      return voiceSegmentOutput(startedAt, "skip_too_short", audio, {
        threshold,
        silenceMs,
        preBufferMs,
        preBufferIncludedMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        durationMs,
        maxRms,
        averageRms: averageRms(totalRms, sampleCount),
        mimeType: audio.type,
        size: audio.size,
        reason: "Voice activity was too short to send."
      });
    }
    return voiceSegmentOutput(startedAt, "send_voice_segment", audio, {
      threshold,
      silenceMs,
      preBufferMs,
      preBufferIncludedMs,
      maxWaitMs,
      maxRecordMs,
      minVoiceMs,
      voiceActiveMs,
      durationMs,
      maxRms,
      averageRms: averageRms(totalRms, sampleCount),
      mimeType: audio.type,
      size: audio.size,
      reason: "Voice activity crossed the threshold and the segment ended after silence."
    });
  } catch (error) {
    return {
      status: errorStatus("VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT", startedAt, error),
      decision: "skip_empty_audio",
      audio: null,
      debug: {
        threshold,
        silenceMs,
        preBufferMs,
        preBufferIncludedMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        durationMs: Date.now() - startedMs,
        maxRms,
        averageRms: averageRms(totalRms, sampleCount),
        mimeType,
        size,
        reason: errorMessage(error)
      }
    };
  }
}

async function captureAfterVoiceStart(input: {
  input: Parameters<typeof VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT>[0];
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
  recorderMimeType: string;
  threshold: number;
  silenceMs: number;
  maxWaitMs: number;
  maxRecordMs: number;
  sampleEveryMs: number;
  startedMs: number;
  updateStats: (rms: number, voiceDetected: boolean) => void;
  setMimeType: (value: string) => void;
  setSize: (value: number) => void;
}) {
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  let recordingStartedMs = 0;
  let lastVoiceMs = 0;
  let sawVoice = false;
  let stopped = false;

  return new Promise<Blob | null>((resolve, reject) => {
    const finish = (value: Blob | null) => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      input.source.disconnect();
      void input.context.close().catch(() => undefined);
      resolve(value);
    };
    const stopRecorder = () => {
      if (recorder?.state === "recording") {
        recorder.stop();
        return;
      }
      finish(null);
    };
    const timer = window.setInterval(() => {
      if (input.input.shouldStop?.()) {
        stopRecorder();
        return;
      }
      input.analyser.getByteTimeDomainData(input.samples);
      const rms = audioRms(input.samples);
      const voiceDetected = rms >= input.threshold;
      input.updateStats(rms, Boolean(recorder && voiceDetected));
      input.input.onSample?.({ rms, voiceDetected });
      const now = Date.now();
      if (voiceDetected) {
        sawVoice = true;
        lastVoiceMs = now;
        if (!recorder) {
          recorder = new MediaRecorder(input.input.stream, input.recorderMimeType ? { mimeType: input.recorderMimeType } : undefined);
          const mimeType = recorder.mimeType || input.recorderMimeType || "audio/webm";
          input.setMimeType(mimeType);
          recordingStartedMs = now;
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };
          recorder.onerror = () => reject(new Error("Browser audio segment recording failed."));
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: mimeType });
            input.setSize(blob.size);
            finish(blob);
          };
          recorder.start(250);
        }
      }
      if (!recorder && now - input.startedMs >= input.maxWaitMs) {
        finish(null);
        return;
      }
      if (recorder && now - recordingStartedMs >= input.maxRecordMs) {
        stopRecorder();
        return;
      }
      if (recorder && sawVoice && now - lastVoiceMs >= input.silenceMs) {
        stopRecorder();
      }
    }, input.sampleEveryMs);
  });
}

async function captureWithPrebuffer(input: {
  input: Parameters<typeof VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT>[0];
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Uint8Array<ArrayBuffer>;
  recorderMimeType: string;
  threshold: number;
  silenceMs: number;
  preBufferMs: number;
  maxWaitMs: number;
  maxRecordMs: number;
  sampleEveryMs: number;
  startedMs: number;
  updateStats: (rms: number, voiceDetected: boolean) => void;
  setMimeType: (value: string) => void;
  setSize: (value: number) => void;
  setPreBufferIncludedMs: (value: number) => void;
}) {
  const recorder = new MediaRecorder(input.input.stream, input.recorderMimeType ? { mimeType: input.recorderMimeType } : undefined);
  const chunks: Array<{ blob: Blob; receivedAtMs: number }> = [];
  let speechStartedMs = 0;
  let lastVoiceMs = 0;
  let sawVoice = false;
  let stopped = false;

  return new Promise<Blob | null>((resolve, reject) => {
    const finish = (value: Blob | null) => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      input.source.disconnect();
      void input.context.close().catch(() => undefined);
      resolve(value);
    };
    const stopRecorder = (sendAudio: boolean) => {
      if (recorder.state === "recording") {
        recorder.onstop = () => {
          if (!sendAudio) {
            finish(null);
            return;
          }
          const includeFromMs = speechStartedMs ? speechStartedMs - input.preBufferMs : Date.now();
          const selectedChunks = chunks.filter((chunk, index) => index === 0 || chunk.receivedAtMs >= includeFromMs).map((chunk) => chunk.blob);
          const blob = new Blob(selectedChunks, { type: recorder.mimeType || input.recorderMimeType || "audio/webm" });
          input.setSize(blob.size);
          finish(blob);
        };
        recorder.stop();
        return;
      }
      finish(null);
    };
    const mimeType = recorder.mimeType || input.recorderMimeType || "audio/webm";
    input.setMimeType(mimeType);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push({ blob: event.data, receivedAtMs: Date.now() });
    };
    recorder.onerror = () => reject(new Error("Browser audio segment recording failed."));
    recorder.onstop = () => {
      const includeFromMs = speechStartedMs ? speechStartedMs - input.preBufferMs : Date.now();
      const selectedChunks = chunks.filter((chunk, index) => index === 0 || chunk.receivedAtMs >= includeFromMs).map((chunk) => chunk.blob);
      const blob = new Blob(selectedChunks, { type: mimeType });
      input.setSize(blob.size);
      finish(blob);
    };
    recorder.start(250);
    const timer = window.setInterval(() => {
      if (input.input.shouldStop?.()) {
        stopRecorder(false);
        return;
      }
      input.analyser.getByteTimeDomainData(input.samples);
      const rms = audioRms(input.samples);
      const voiceDetected = rms >= input.threshold;
      input.updateStats(rms, voiceDetected);
      input.input.onSample?.({ rms, voiceDetected });
      const now = Date.now();
      if (voiceDetected) {
        if (!sawVoice) {
          speechStartedMs = now;
          input.setPreBufferIncludedMs(Math.min(input.preBufferMs, Math.max(0, now - input.startedMs)));
        }
        sawVoice = true;
        lastVoiceMs = now;
      }
      if (!sawVoice && now - input.startedMs >= input.maxWaitMs) {
        stopRecorder(false);
        return;
      }
      if (sawVoice && now - speechStartedMs >= input.maxRecordMs) {
        stopRecorder(true);
        return;
      }
      if (sawVoice && now - lastVoiceMs >= input.silenceMs) {
        stopRecorder(true);
      }
    }, input.sampleEveryMs);
  });
}

function chooseMediaRecorderMimeType(preferred?: string) {
  const candidates = [
    preferred || "",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus"
  ].filter(Boolean);
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return preferred || "";
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
}

function audioRms(samples: Uint8Array<ArrayBuffer>) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  return Number(Math.sqrt(sum / samples.length).toFixed(4));
}

function averageRms(totalRms: number, sampleCount: number) {
  return Number((sampleCount ? totalRms / sampleCount : 0).toFixed(4));
}

function voiceSegmentOutput(
  startedAt: string,
  decision: VoiceAgentV2VoiceSegmentDecision,
  audio: Blob | null,
  debug: VoiceAgentV2VoiceSegment["debug"]
): VoiceAgentV2VoiceSegment {
  return {
    status: doneStatus("VOICE_AGENT_V2_CAPTURE_VOICE_SEGMENT", startedAt),
    decision,
    audio,
    debug
  };
}

function doneStatus(method: string, startedAt: string): VoiceAgentV2CaptureStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorStatus(method: string, startedAt: string, error: unknown): VoiceAgentV2CaptureStatus {
  return { method, ok: false, phase: "error", startedAt, finishedAt: new Date().toISOString(), error: errorMessage(error) };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
