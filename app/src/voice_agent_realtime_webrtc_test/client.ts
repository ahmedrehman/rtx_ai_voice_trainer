import type {
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

function audioRms(samples: Uint8Array) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  return Number(Math.sqrt(sum / samples.length).toFixed(4));
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
