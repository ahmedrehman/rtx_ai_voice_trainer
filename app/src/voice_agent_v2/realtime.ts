import type { VoiceAgentV2Settings, VoiceAgentV2VisibleHistoryItem } from ".";

export type VoiceAgentV2RealtimeStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type VoiceAgentV2RealtimeState = {
  peerState: RTCPeerConnectionState | "none";
  dataChannelState: RTCDataChannelState | "none";
  outgoingMicEnabled: boolean;
  outgoingMicReason: "listen_off" | "speak_feedback" | "enabled";
};

export type VoiceAgentV2RealtimeConnection = {
  status: VoiceAgentV2RealtimeStatus;
  stop: () => void;
  setListenEnabled: (enabled: boolean) => void;
  setAiSpeaking: (speaking: boolean) => void;
};

export type VoiceAgentV2RealtimeEventResult = {
  type: string;
  aiSpeaking?: boolean;
  textDelta?: string;
  textDone?: string;
  correctionEvent?: VoiceAgentV2RealtimeCorrectionEvent;
  error?: string;
};

export type VoiceAgentV2RealtimeCorrectionEvent = {
  correction: 0 | 1 | 2 | 3;
  text?: string;
  hint?: string;
  raw: unknown;
};

type BrowserAudioContextConstructor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: BrowserAudioContextConstructor;
  }
}

export async function VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE(): Promise<{ status: VoiceAgentV2RealtimeStatus; stream: MediaStream | null }> {
  const startedAt = new Date().toISOString();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Browser microphone API is unavailable.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    return { status: doneStatus("VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE", startedAt), stream };
  } catch (error) {
    return { status: errorStatus("VOICE_AGENT_V2_REALTIME_OPEN_MICROPHONE", startedAt, error), stream: null };
  }
}

export async function VOICE_AGENT_V2_REALTIME_CREATE_CLIENT_SECRET(input: {
  endpoint?: string;
  settings: VoiceAgentV2Settings;
  visibleHistory: VoiceAgentV2VisibleHistoryItem[];
}) {
  const response = await fetch(input.endpoint || "/api/voice-agent/realtime-client-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-realtime",
      voice: normalizeVoice(input.settings.voice),
      instructions: VOICE_AGENT_V2_REALTIME_CREATE_INSTRUCTIONS(input.settings, input.visibleHistory)
    })
  });
  const data = await response.json().catch(() => ({ error: "Client secret response was not JSON." }));
  if (!response.ok) throw new Error(JSON.stringify(data));
  const clientSecret = readClientSecret(data);
  if (!clientSecret) throw new Error("Realtime client secret response did not include a usable secret value.");
  return { clientSecret, data };
}

export function VOICE_AGENT_V2_REALTIME_MONITOR_MIC(input: {
  stream: MediaStream;
  threshold?: number;
  onSample: (sample: { rms: number; voiceDetected: boolean }) => void;
}) {
  const threshold = input.threshold ?? 0.025;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return { stop: () => undefined };
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
  return {
    stop: () => {
      window.cancelAnimationFrame(animationFrame);
      source.disconnect();
      void context.close().catch(() => undefined);
    }
  };
}

export async function VOICE_AGENT_V2_REALTIME_CONNECT(input: {
  stream: MediaStream;
  clientSecret: string;
  listenEnabled: boolean;
  suppressSpeakerFeedback: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
  onEvent?: (event: unknown) => void;
  onState?: (state: VoiceAgentV2RealtimeState) => void;
}): Promise<VoiceAgentV2RealtimeConnection> {
  const startedAt = new Date().toISOString();
  let peer: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let listenEnabled = input.listenEnabled;
  let aiSpeaking = false;
  let outgoingTrack: MediaStreamTrack | null = null;

  function outgoingMicReason(): VoiceAgentV2RealtimeState["outgoingMicReason"] {
    if (!listenEnabled) return "listen_off";
    if (input.suppressSpeakerFeedback && aiSpeaking) return "speak_feedback";
    return "enabled";
  }

  function state(): VoiceAgentV2RealtimeState {
    const reason = outgoingMicReason();
    return {
      peerState: peer?.connectionState || "none",
      dataChannelState: dataChannel?.readyState || "none",
      outgoingMicEnabled: reason === "enabled",
      outgoingMicReason: reason
    };
  }

  function updateOutgoingMicTrack() {
    if (outgoingTrack) outgoingTrack.enabled = outgoingMicReason() === "enabled";
    input.onState?.(state());
  }

  function stop() {
    dataChannel?.close();
    peer?.close();
    outgoingTrack?.stop();
    dataChannel = null;
    peer = null;
    outgoingTrack = null;
    input.onState?.(state());
  }

  try {
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
        Authorization: `Bearer ${input.clientSecret}`,
        "Content-Type": "application/sdp"
      }
    });
    if (!answerResponse.ok) throw new Error(await answerResponse.text().catch(() => `Realtime SDP exchange failed with ${answerResponse.status}`));
    await peer.setRemoteDescription({ type: "answer", sdp: await answerResponse.text() });
    input.onState?.(state());

    return {
      status: doneStatus("VOICE_AGENT_V2_REALTIME_CONNECT", startedAt),
      stop,
      setListenEnabled: (enabled) => {
        listenEnabled = enabled;
        updateOutgoingMicTrack();
      },
      setAiSpeaking: (speaking) => {
        aiSpeaking = speaking;
        updateOutgoingMicTrack();
      }
    };
  } catch (error) {
    stop();
    return {
      status: errorStatus("VOICE_AGENT_V2_REALTIME_CONNECT", startedAt, error),
      stop: () => undefined,
      setListenEnabled: () => undefined,
      setAiSpeaking: () => undefined
    };
  }
}

export function VOICE_AGENT_V2_REALTIME_EVENT_RESULT(event: unknown): VoiceAgentV2RealtimeEventResult {
  const eventType = typeof event === "object" && event && "type" in event ? String((event as { type?: unknown }).type) : "unknown";
  const correctionEvent = extractCorrectionEvent(event);
  if (correctionEvent) {
    return eventType.includes(".delta")
      ? { type: eventType, correctionEvent, textDelta: correctionEvent.text }
      : { type: eventType, correctionEvent, textDone: correctionEvent.text };
  }
  if (eventType === "response.audio.done" || eventType === "response.done" || eventType === "output_audio_buffer.stopped") {
    return { type: eventType, aiSpeaking: false, textDone: extractRealtimeText(event) };
  }
  if (eventType.includes("response.audio") || eventType === "output_audio_buffer.started") {
    return { type: eventType, aiSpeaking: true, textDelta: extractString(event, ["delta", "transcript", "text"]) };
  }
  if (eventType.includes("response.text") || eventType.includes("response.output_text") || eventType.includes("transcript")) {
    const text = extractString(event, ["delta", "transcript", "text"]);
    return eventType.includes(".done") ? { type: eventType, textDone: text } : { type: eventType, textDelta: text };
  }
  if (eventType === "error") return { type: eventType, error: JSON.stringify(event) };
  return { type: eventType };
}

export function VOICE_AGENT_V2_REALTIME_CREATE_INSTRUCTIONS(settings: VoiceAgentV2Settings, history: VoiceAgentV2VisibleHistoryItem[]) {
  const mode = settings.allowFreeChat ? "Free chat mode is enabled." : "Correction mode is enabled.";
  const visibleHistory = history.length ? `Visible text history:\n${history.map((item) => `${item.role}: ${item.text}`).join("\n")}` : "No visible text history.";
  return [
    "You are AI Voice Trainer in a realtime speech-to-speech browser app.",
    `Target language: ${settings.languageName}.`,
    `Topic/context: ${settings.topic}.`,
    mode,
    "Reply with spoken audio directly. Keep every answer very short.",
    "Also emit the same short answer as response transcript/text events when available.",
    "Also include correction fields when available: correction 0 none, 1 small improvement/pronunciation, 2 important improvement, 3 grammar or very wrong; text; optional hint. JSON is preferred, but plain text like \"correction 2: ... hint: ...\" is acceptable.",
    settings.allowFreeChat
      ? "Answer the user's question naturally. Correct only when the user asks for correction or clearly practices the language."
      : "For practice speech, say only one corrected phrase and one tiny hint when useful. If there is no useful correction, stay silent or give a very short confirmation.",
    "Example correction: Je suis malade, avec etre.",
    "Do not greet. Do not explain implementation details. Do not say JSON.",
    "If you hear your own previous answer through the microphone, ignore it and stay silent.",
    visibleHistory
  ].join("\n");
}

export function normalizeVoice(value: string) {
  const normalized = value.toLowerCase().trim();
  if (["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"].includes(normalized)) return normalized;
  return "marin";
}

function readClientSecret(value: unknown) {
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

function parseRealtimeEvent(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { type: "unparseable_message", value };
  }
}

function extractRealtimeText(value: unknown): string {
  const direct = extractString(value, ["transcript", "text", "delta"]);
  if (direct) return direct;
  const seen = new Set<unknown>();
  const found: string[] = [];
  const walk = (item: unknown) => {
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    const record = item as Record<string, unknown>;
    ["transcript", "text"].forEach((key) => {
      if (typeof record[key] === "string" && record[key].trim()) found.push(record[key]);
    });
    Object.values(record).forEach(walk);
  };
  walk(value);
  return found.join(" ").trim();
}

function extractCorrectionEvent(value: unknown): VoiceAgentV2RealtimeCorrectionEvent | null {
  const candidates = collectCorrectionCandidates(value);
  for (const candidate of candidates) {
    const parsed = parseMaybeJson(candidate);
    if (parsed && typeof parsed === "object") {
      const fromRecord = correctionEventFromRecord(parsed as Record<string, unknown>);
      if (fromRecord) return fromRecord;
    }
    if (typeof candidate === "string") {
      const fromText = correctionEventFromText(candidate);
      if (fromText) return fromText;
    }
  }
  return null;
}

function collectCorrectionCandidates(value: unknown) {
  const candidates: unknown[] = [];
  const seen = new Set<unknown>();
  const walk = (item: unknown) => {
    if (typeof item === "string") {
      if (isCorrectionTextCandidate(item)) candidates.push(item);
      return;
    }
    if (!item || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    const record = item as Record<string, unknown>;
    if ("correction" in record || "correction_level" in record) candidates.push(record);
    Object.values(record).forEach(walk);
  };
  walk(value);
  return candidates;
}

function correctionEventFromRecord(record: Record<string, unknown>): VoiceAgentV2RealtimeCorrectionEvent | null {
  const correction = normalizeCorrectionLevel(record.correction ?? record.correction_level ?? record.level ?? record.severity);
  if (correction === null) return null;
  const text =
    firstString(record.text, record.chat_text_to_user, record.message, record.answer, record.corrected_text, record.text_corrected) ||
    undefined;
  return {
    correction,
    text,
    hint: firstString(record.hint, record.tip, record.conseil) || undefined,
    raw: record
  };
}

function correctionEventFromText(value: string): VoiceAgentV2RealtimeCorrectionEvent | null {
  const correction = correctionLevelFromText(value);
  if (correction === null) return null;
  return {
    correction,
    text: cleanCorrectionText(value) || undefined,
    hint: extractCorrectionHint(value) || undefined,
    raw: value
  };
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*"correction"[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeCorrectionLevel(value: unknown): 0 | 1 | 2 | 3 | null {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  if (value === "0" || value === "1" || value === "2" || value === "3") return Number(value) as 0 | 1 | 2 | 3;
  if (typeof value === "string") return correctionLevelFromText(value);
  return null;
}

function correctionLevelFromText(value: string): 0 | 1 | 2 | 3 | null {
  const explicit = value.match(/\b(?:correction(?:_level)?|level|severity|niveau)\s*[:=#-]?\s*([0-3])\b/i);
  if (explicit?.[1]) return Number(explicit[1]) as 0 | 1 | 2 | 3;
  const text = value.toLowerCase();
  if (/\b(no correction|none|ok|correct)\b/.test(text)) return 0;
  if (/\b(grammar|grammaire|spelling|orthographe|very wrong)\b/.test(text)) return 3;
  if (/\b(vocabulary|vocabulaire|meaning|important improvement|important correction)\b/.test(text)) return 2;
  if (/\b(pronunciation|prononciation|accent|small improvement|slight improvement)\b/.test(text)) return 1;
  return null;
}

function isCorrectionTextCandidate(value: string) {
  return /\b(correction(?:_level)?|level|severity|niveau|grammar|grammaire|spelling|orthographe|pronunciation|prononciation|accent|vocabulary|vocabulaire|meaning|hint|tip|conseil)\b/i.test(
    value
  );
}

function extractCorrectionHint(value: string) {
  return value.match(/\b(?:hint|tip|conseil)\s*[:=-]\s*(.+)$/i)?.[1]?.trim() || "";
}

function cleanCorrectionText(value: string) {
  const withoutHint = value.replace(/\b(?:hint|tip|conseil)\s*[:=-]\s*.+$/i, "").trim();
  return withoutHint
    .replace(/^\s*(?:correction(?:_level)?|level|severity|niveau)\s*[:=#-]?\s*[0-3]\s*[:,-]?\s*/i, "")
    .replace(/^\s*(?:grammar|grammaire|spelling|orthographe|pronunciation|prononciation|accent|vocabulary|vocabulaire|meaning)\s*[:=-]?\s*/i, "")
    .trim();
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function extractString(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

function audioRms(samples: Uint8Array<ArrayBuffer>) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = (samples[index] - 128) / 128;
    sum += centered * centered;
  }
  return Number(Math.sqrt(sum / samples.length).toFixed(4));
}

function doneStatus(method: string, startedAt: string): VoiceAgentV2RealtimeStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorStatus(method: string, startedAt: string, error: unknown): VoiceAgentV2RealtimeStatus {
  return { method, ok: false, phase: "error", startedAt, finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
}
