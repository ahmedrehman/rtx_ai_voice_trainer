import type {
  AudioRoundtripRecordOutput,
  AudioRoundtripVoiceSegmentOutput,
  AudioRoundtripServerOutput,
  RealtimeWebrtcConfig,
  RealtimeWebrtcConnection,
  RealtimeWebrtcConnectionInput,
  RealtimeWebrtcConnectionState,
  RealtimeWebrtcEventDecision,
  RealtimeWebrtcMicMonitor,
  RealtimeWebrtcMicMonitorSample,
  RealtimeWebrtcMicSession,
  RealtimeWebrtcStatus
} from "./types";

export async function VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE(
  config: RealtimeWebrtcConfig,
  input: { constraints?: MediaStreamConstraints } = {}
): Promise<RealtimeWebrtcMicSession> {
  const startedAt = new Date().toISOString();
  const constraints = input.constraints || {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  };
  log(config, "info", "VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE", "start", { constraints });
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser microphone API is unavailable.");
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const output = {
      status: doneStatus("VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE", startedAt),
      stream,
      debug: { constraints }
    };
    log(config, "info", "VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE", "done", { audioTracks: stream.getAudioTracks().length });
    return output;
  } catch (error) {
    log(config, "error", "VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE", errorMessage(error));
    return {
      status: errorStatus("VOICE_AGENT_REALTIME_BROWSER_OPEN_MICROPHONE", startedAt, error),
      stream: null,
      debug: { constraints }
    };
  }
}

export function VOICE_AGENT_REALTIME_BROWSER_MONITOR_MIC_LEVEL(
  config: RealtimeWebrtcConfig,
  input: {
    stream: MediaStream;
    threshold?: number;
    onSample: (sample: RealtimeWebrtcMicMonitorSample) => void;
  }
): RealtimeWebrtcMicMonitor {
  const startedAt = new Date().toISOString();
  const threshold = input.threshold ?? 0.035;
  const method = "VOICE_AGENT_REALTIME_BROWSER_MONITOR_MIC_LEVEL";
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Browser AudioContext is unavailable.");
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(input.stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let animationFrame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      const rms = audioRms(samples);
      input.onSample({ rms, voiceDetected: rms >= threshold });
      animationFrame = window.requestAnimationFrame(tick);
    };
    tick();
    log(config, "info", method, "done", { threshold });
    return {
      status: doneStatus(method, startedAt),
      stop: () => {
        window.cancelAnimationFrame(animationFrame);
        source.disconnect();
        void context.close().catch(() => undefined);
      }
    };
  } catch (error) {
    log(config, "error", method, errorMessage(error));
    return {
      status: errorStatus(method, startedAt, error),
      stop: () => undefined
    };
  }
}

export async function VOICE_AGENT_REALTIME_BROWSER_RECORD_AUDIO_SAMPLE(
  config: RealtimeWebrtcConfig,
  input: {
    stream: MediaStream;
    durationMs: number;
    mimeType?: string;
  }
): Promise<AudioRoundtripRecordOutput> {
  const startedAt = new Date().toISOString();
  const method = "VOICE_AGENT_REALTIME_BROWSER_RECORD_AUDIO_SAMPLE";
  const durationMs = Math.max(300, input.durationMs);
  try {
    if (typeof MediaRecorder === "undefined") throw new Error("Browser MediaRecorder API is unavailable.");
    const mimeType = chooseMediaRecorderMimeType(input.mimeType);
    const recorder = new MediaRecorder(input.stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const audio = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Browser audio recording failed."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      recorder.start(250);
      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationMs);
    });
    log(config, "info", method, "done", { size: audio.size, type: audio.type, durationMs });
    return {
      status: doneStatus(method, startedAt),
      audio,
      debug: {
        durationMs,
        mimeType: audio.type,
        size: audio.size
      }
    };
  } catch (error) {
    log(config, "error", method, errorMessage(error));
    return {
      status: errorStatus(method, startedAt, error),
      audio: null,
      debug: {
        durationMs,
        mimeType: input.mimeType || "",
        size: 0
      }
    };
  }
}

export async function VOICE_AGENT_REALTIME_BROWSER_CAPTURE_VOICE_SEGMENT(
  config: RealtimeWebrtcConfig,
  input: {
    stream: MediaStream;
    threshold?: number;
    silenceMs?: number;
    preBufferMs?: number;
    maxWaitMs?: number;
    maxRecordMs?: number;
    minVoiceMs?: number;
    mimeType?: string;
    onSample?: (sample: RealtimeWebrtcMicMonitorSample) => void;
    shouldStop?: () => boolean;
  }
): Promise<AudioRoundtripVoiceSegmentOutput> {
  const startedAt = new Date().toISOString();
  const method = "VOICE_AGENT_REALTIME_BROWSER_CAPTURE_VOICE_SEGMENT";
  const threshold = input.threshold ?? 0.025;
  const silenceMs = input.silenceMs ?? 650;
  const preBufferMs = Math.max(0, input.preBufferMs ?? 1000);
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
  let speechStartedAfterMs = 0;
  let preBufferIncludedMs = 0;
  let preBufferChunks = 0;

  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Browser AudioContext is unavailable.");
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(input.stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const processor = context.createScriptProcessor(2048, 1, 1);
    const mutedOutput = context.createGain();
    mutedOutput.gain.value = 0;
    source.connect(processor);
    processor.connect(mutedOutput);
    mutedOutput.connect(context.destination);
    const samples = new Uint8Array(analyser.fftSize);
    type AudioChunk = { samples: Float32Array; startedAtMs: number; durationMs: number };
    let preBuffer: AudioChunk[] = [];
    let recordingChunks: AudioChunk[] = [];
    let speechStartedMs = 0;
    let lastVoiceMs = 0;
    let sawVoice = false;
    let recording = false;
    let stopped = false;

    mimeType = "audio/wav";

    const audio = await new Promise<Blob | null>((resolve) => {
      const finish = (value: Blob | null) => {
        if (stopped) return;
        stopped = true;
        window.clearInterval(timer);
        processor.onaudioprocess = null;
        processor.disconnect();
        mutedOutput.disconnect();
        source.disconnect();
        void context.close().catch(() => undefined);
        resolve(value);
      };
      const stopRecording = () => {
        if (!recording) {
          finish(null);
          return;
        }
        const blob = createWavBlob(recordingChunks.map((chunk) => chunk.samples), context.sampleRate);
        size = blob.size;
        finish(blob);
      };
      processor.onaudioprocess = (event) => {
        if (stopped) return;
        const inputChannel = event.inputBuffer.getChannelData(0);
        const copied = new Float32Array(inputChannel.length);
        copied.set(inputChannel);
        const duration = (copied.length / context.sampleRate) * 1000;
        const now = Date.now();
        const chunk = { samples: copied, startedAtMs: now - duration, durationMs: duration };
        if (recording) {
          recordingChunks.push(chunk);
          return;
        }
        preBuffer.push(chunk);
        const earliest = now - preBufferMs;
        preBuffer = preBuffer.filter((candidate) => candidate.startedAtMs + candidate.durationMs >= earliest);
      };
      const timer = window.setInterval(() => {
        if (input.shouldStop?.()) {
          stopRecording();
          return;
        }
        analyser.getByteTimeDomainData(samples);
        const rms = audioRms(samples);
        sampleCount += 1;
        totalRms += rms;
        maxRms = Math.max(maxRms, rms);
        const voiceDetected = rms >= threshold;
        input.onSample?.({ rms, voiceDetected });
        const now = Date.now();
        if (voiceDetected) {
          sawVoice = true;
          lastVoiceMs = now;
          voiceActiveMs += sampleEveryMs;
          if (!recording) {
            recording = true;
            speechStartedMs = now;
            speechStartedAfterMs = now - startedMs;
            const earliest = now - preBufferMs;
            const included = preBuffer.filter((chunk) => chunk.startedAtMs + chunk.durationMs >= earliest);
            recordingChunks = included.slice();
            preBufferChunks = included.length;
            preBufferIncludedMs = Math.round(included.reduce((total, chunk) => total + chunk.durationMs, 0));
          }
        }
        if (!recording && now - startedMs >= maxWaitMs) {
          finish(null);
          return;
        }
        if (recording && now - speechStartedMs >= maxRecordMs) {
          stopRecording();
          return;
        }
        if (recording && sawVoice && now - lastVoiceMs >= silenceMs) {
          stopRecording();
        }
      }, sampleEveryMs);
    });

    durationMs = Date.now() - startedMs;
    if (!audio) {
      return voiceSegmentOutput(startedAt, "skip_no_voice", null, {
        threshold,
        silenceMs,
        preBufferMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        speechStartedAfterMs,
        preBufferIncludedMs,
        preBufferChunks,
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
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        speechStartedAfterMs,
        preBufferIncludedMs,
        preBufferChunks,
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
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        speechStartedAfterMs,
        preBufferIncludedMs,
        preBufferChunks,
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
      maxWaitMs,
      maxRecordMs,
      minVoiceMs,
      voiceActiveMs,
      speechStartedAfterMs,
      preBufferIncludedMs,
      preBufferChunks,
      durationMs,
      maxRms,
      averageRms: averageRms(totalRms, sampleCount),
      mimeType: audio.type,
      size: audio.size,
      reason: "Voice activity crossed the threshold and the segment ended after silence."
    });
  } catch (error) {
    log(config, "error", method, errorMessage(error));
    return {
      status: errorStatus(method, startedAt, error),
      decision: "skip_empty_audio",
      audio: null,
      debug: {
        threshold,
        silenceMs,
        preBufferMs,
        maxWaitMs,
        maxRecordMs,
        minVoiceMs,
        voiceActiveMs,
        speechStartedAfterMs,
        preBufferIncludedMs,
        preBufferChunks,
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

export async function VOICE_AGENT_REALTIME_SERVER_AUDIO_ROUNDTRIP(
  config: RealtimeWebrtcConfig,
  input: {
    endpoint: string;
    audio: Blob;
  }
): Promise<AudioRoundtripServerOutput> {
  const startedAt = new Date().toISOString();
  const method = "VOICE_AGENT_REALTIME_SERVER_AUDIO_ROUNDTRIP";
  const startedMs = Date.now();
  try {
    const response = await fetch(input.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": input.audio.type || "application/octet-stream"
      },
      body: input.audio
    });
    if (!response.ok) throw new Error(await response.text().catch(() => `Audio roundtrip failed with ${response.status}`));
    const audio = await response.blob();
    const output = {
      status: doneStatus(method, startedAt),
      audio,
      debug: {
        endpoint: input.endpoint,
        requestContentType: input.audio.type || "application/octet-stream",
        requestSize: input.audio.size,
        responseContentType: audio.type || response.headers.get("Content-Type") || "",
        responseSize: audio.size,
        durationMs: Date.now() - startedMs
      }
    };
    log(config, "info", method, "done", output.debug);
    return output;
  } catch (error) {
    log(config, "error", method, errorMessage(error));
    return {
      status: errorStatus(method, startedAt, error),
      audio: null,
      debug: {
        endpoint: input.endpoint,
        requestContentType: input.audio.type || "application/octet-stream",
        requestSize: input.audio.size,
        responseContentType: "",
        responseSize: 0,
        durationMs: Date.now() - startedMs
      }
    };
  }
}

export async function VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC(
  config: RealtimeWebrtcConfig,
  input: RealtimeWebrtcConnectionInput
): Promise<RealtimeWebrtcConnection> {
  const startedAt = new Date().toISOString();
  let peer: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let sendToAi = input.sendToAi;
  let localVoiceDetected = input.localVoiceDetected;
  let requireLocalVoice = input.requireLocalVoice;
  let suppressSpeakerFeedback = input.suppressSpeakerFeedback;
  let aiSpeaking = false;
  let outgoingTrack: MediaStreamTrack | null = null;

  function state(): RealtimeWebrtcConnectionState {
    return {
      peerState: peer?.connectionState || "none",
      dataChannelState: dataChannel?.readyState || "none",
      outgoingMicEnabled: outgoingMicEnabled(),
      outgoingMicReason: outgoingMicReason(),
      localVoiceDetected
    };
  }

  function outgoingMicEnabled() {
    return outgoingMicReason() === "enabled";
  }

  function outgoingMicReason(): RealtimeWebrtcConnectionState["outgoingMicReason"] {
    if (!sendToAi) return "send_to_ai_off";
    if (suppressSpeakerFeedback && aiSpeaking) return "ai_speaking";
    if (requireLocalVoice && !localVoiceDetected) return "silence";
    return "enabled";
  }

  function updateOutgoingMicTrack() {
    const enabled = outgoingMicEnabled();
    if (outgoingTrack) outgoingTrack.enabled = enabled;
    input.onState?.(state());
  }

  function stop() {
    dataChannel?.close();
    peer?.close();
    outgoingTrack?.stop();
    outgoingTrack = null;
    dataChannel = null;
    peer = null;
    input.onState?.(state());
  }

  try {
    if (!input.clientSecret) throw new Error("Realtime client secret is empty.");
    peer = new RTCPeerConnection();
    peer.onconnectionstatechange = () => input.onState?.(state());
    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) input.onRemoteStream?.(stream);
    };
    const [audioTrack] = input.stream.getAudioTracks();
    if (!audioTrack) throw new Error("Microphone stream has no audio track.");
    outgoingTrack = audioTrack.clone();
    peer.addTrack(outgoingTrack, new MediaStream([outgoingTrack]));

    dataChannel = peer.createDataChannel("oai-events");
    dataChannel.onopen = () => input.onState?.(state());
    dataChannel.onclose = () => input.onState?.(state());
    dataChannel.onerror = () => input.onState?.(state());
    dataChannel.onmessage = (message) => input.onEvent?.(parseRealtimeEvent(message.data));

    updateOutgoingMicTrack();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (!offer.sdp) throw new Error("WebRTC offer did not contain SDP.");

    const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: offer.sdp,
      headers: {
        "Authorization": `Bearer ${input.clientSecret}`,
        "Content-Type": "application/sdp"
      }
    });
    if (!answerResponse.ok) throw new Error(await answerResponse.text().catch(() => `Realtime SDP exchange failed with ${answerResponse.status}`));
    await peer.setRemoteDescription({ type: "answer", sdp: await answerResponse.text() });
    input.onState?.(state());

    return {
      status: doneStatus("VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC", startedAt),
      peer,
      dataChannel,
      setSendToAi: (next) => {
        sendToAi = next;
        updateOutgoingMicTrack();
      },
      setLocalVoiceDetected: (next) => {
        localVoiceDetected = next;
        updateOutgoingMicTrack();
      },
      setAiSpeaking: (next) => {
        aiSpeaking = next;
        updateOutgoingMicTrack();
      },
      setSuppressSpeakerFeedback: (next) => {
        suppressSpeakerFeedback = next;
        updateOutgoingMicTrack();
      },
      stop,
      debug: {
        endpoint: "POST /v1/realtime/calls",
        sendToAi,
        suppressSpeakerFeedback
      }
    };
  } catch (error) {
    stop();
    log(config, "error", "VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC", errorMessage(error));
    return {
      status: errorStatus("VOICE_AGENT_REALTIME_BROWSER_CONNECT_WEBRTC", startedAt, error),
      peer: null,
      dataChannel: null,
      setSendToAi: () => undefined,
      setLocalVoiceDetected: () => undefined,
      setAiSpeaking: () => undefined,
      setSuppressSpeakerFeedback: () => undefined,
      stop: () => undefined,
      debug: {
        endpoint: "POST /v1/realtime/calls",
        sendToAi,
        suppressSpeakerFeedback
      }
    };
  }
}

export function VOICE_AGENT_REALTIME_DECIDE_EVENT_STATE(event: unknown): RealtimeWebrtcEventDecision {
  const eventType = typeof event === "object" && event && "type" in event ? String((event as { type?: unknown }).type) : "unknown";
  if (eventType === "input_audio_buffer.speech_started") return { eventType, realtimeSpeechDetected: true };
  if (eventType === "input_audio_buffer.speech_stopped") return { eventType, realtimeSpeechDetected: false };
  if (eventType.includes("response.audio") || eventType === "output_audio_buffer.started") return { eventType, aiSpeaking: true };
  if (eventType === "response.done" || eventType === "output_audio_buffer.stopped") return { eventType, aiSpeaking: false };
  if (eventType === "error") return { eventType, error: JSON.stringify(event) };
  return { eventType };
}

export function VOICE_AGENT_REALTIME_READ_CLIENT_SECRET(value: unknown) {
  const data = value as {
    value?: unknown;
    client_secret?: { value?: unknown };
    session?: { client_secret?: { value?: unknown } };
  };
  if (typeof data.value === "string") return data.value;
  if (typeof data.client_secret?.value === "string") return data.client_secret.value;
  if (typeof data.session?.client_secret?.value === "string") return data.session.client_secret.value;
  return "";
}

export function VOICE_AGENT_REALTIME_REDACT_SECRETS(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if ((key === "value" || key === "secret") && typeof item === "string") return `[secret length=${item.length}]`;
    return item;
  }));
}

export function VOICE_AGENT_REALTIME_SUMMARIZE_EVENT(value: unknown) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (typeof item === "string" && (key.includes("audio") || item.length > 400)) return `[string length=${item.length}]`;
    return item;
  }));
}

function parseRealtimeEvent(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { type: "unparseable_message", value };
  }
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

function audioRms(samples: Uint8Array) {
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

function createWavBlob(chunks: Float32Array[], sampleRate: number) {
  const totalSamples = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  writeAscii(view, offset, "RIFF");
  offset += 4;
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeAscii(view, offset, "WAVE");
  offset += 4;
  writeAscii(view, offset, "fmt ");
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeAscii(view, offset, "data");
  offset += 4;
  view.setUint32(offset, dataSize, true);
  offset += 4;
  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function voiceSegmentOutput(
  startedAt: string,
  decision: AudioRoundtripVoiceSegmentOutput["decision"],
  audio: Blob | null,
  debug: AudioRoundtripVoiceSegmentOutput["debug"]
): AudioRoundtripVoiceSegmentOutput {
  return {
    status: doneStatus("VOICE_AGENT_REALTIME_BROWSER_CAPTURE_VOICE_SEGMENT", startedAt),
    decision,
    audio,
    debug
  };
}

function doneStatus(method: string, startedAt: string): RealtimeWebrtcStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorStatus(method: string, startedAt: string, error: unknown): RealtimeWebrtcStatus {
  return { method, ok: false, phase: "error", startedAt, finishedAt: new Date().toISOString(), error: errorMessage(error) };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function log(config: RealtimeWebrtcConfig, level: "info" | "error", method: string, message: string, data?: unknown) {
  config.logger?.({ level, method, message, data, createdAt: new Date().toISOString() });
}
