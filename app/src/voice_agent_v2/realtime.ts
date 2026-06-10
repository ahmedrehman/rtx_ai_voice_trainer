import { VOICE_AGENT_STREAM_VOICE_TURN, type VoiceAgentStreamVoiceTurnEvent } from "../voice_agent";
import {
  VOICE_AGENT_V2_CREATE_PROMPTS,
  VOICE_AGENT_V2_VISIBLE_HISTORY_TEXT,
  type VoiceAgentV2Settings,
  type VoiceAgentV2VisibleHistoryItem
} from ".";

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

export type VoiceAgentV2RealtimeVoicePackDecision =
  | "send_voice_segment"
  | "skip_no_voice"
  | "skip_too_short"
  | "skip_empty_audio"
  | "skip_ai_speaking";

export type VoiceAgentV2RealtimeVoicePack = {
  status: VoiceAgentV2RealtimeStatus;
  decision: VoiceAgentV2RealtimeVoicePackDecision;
  audio: Blob | null;
  transcript: string;
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
    browserSpeechAvailable?: boolean;
    browserSpeechFinalDetected?: boolean;
    browserSpeechText?: string;
  };
};

export type VoiceAgentV2RealtimeVoicePackTurn = {
  status: VoiceAgentV2RealtimeStatus;
  text: string;
  audio: { blob: Blob; audioFormat: string; chunkCount: number } | null;
  events: VoiceAgentStreamVoiceTurnEvent[];
  request: unknown;
  correctionEvent?: VoiceAgentV2RealtimeCorrectionEvent;
};

export type VoiceAgentV2RealtimeAudioRoundtrip = {
  status: VoiceAgentV2RealtimeStatus;
  audio: Blob | null;
  debug: {
    endpoint: string;
    requestContentType: string;
    requestSize: number;
    responseContentType: string;
    responseSize: number;
    durationMs: number;
  };
};

type BrowserAudioContextConstructor = typeof AudioContext;
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type BrowserSpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};
type BrowserSpeechTranscriptCapture = {
  stop: () => { available: boolean; text: string; finalDetected: boolean };
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
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

export async function VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK(input: {
  stream: MediaStream;
  threshold?: number;
  silenceMs?: number;
  preBufferMs?: number;
  recorderWhileListening?: boolean;
  maxWaitMs?: number;
  maxRecordMs?: number;
  minVoiceMs?: number;
  mimeType?: string;
  enableSpeechRecognitionTranscript?: boolean;
  speechRecognitionLang?: string;
  onSample?: (sample: { rms: number; voiceDetected: boolean }) => void;
  shouldStop?: () => boolean;
  shouldSkipSend?: () => boolean;
}): Promise<VoiceAgentV2RealtimeVoicePack> {
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
  let speechCapture: BrowserSpeechTranscriptCapture | null = null;
  const packOutput = (
    decision: VoiceAgentV2RealtimeVoicePackDecision,
    audio: Blob | null,
    debug: Omit<VoiceAgentV2RealtimeVoicePack["debug"], "browserSpeechAvailable" | "browserSpeechFinalDetected" | "browserSpeechText">
  ) => {
    const speech = speechCapture?.stop() || { available: false, text: "", finalDetected: false };
    return voicePackOutput(startedAt, decision, audio, {
      ...debug,
      browserSpeechAvailable: speech.available,
      browserSpeechFinalDetected: speech.finalDetected,
      browserSpeechText: speech.text
    }, speech.text);
  };

  try {
    if (input.shouldSkipSend?.()) {
      return packOutput("skip_ai_speaking", null, {
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
        averageRms: 0,
        mimeType,
        size,
        reason: "NOT SEND - AI audio is playing, so microphone input may be speaker feedback."
      });
    }
    if (typeof MediaRecorder === "undefined") throw new Error("Browser MediaRecorder API is unavailable.");
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Browser AudioContext is unavailable.");
    if (input.enableSpeechRecognitionTranscript) {
      speechCapture = startBrowserSpeechTranscriptCapture(input.speechRecognitionLang);
    }
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(input.stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const recorderMimeType = chooseMediaRecorderMimeType(input.mimeType);
    let audio: Blob | null;

    if (!recorderWhileListening) {
      audio = await captureVoicePackAfterStart({
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
      audio = await captureVoicePackWithPrebuffer({
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
      return packOutput("skip_no_voice", null, {
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
        reason: input.shouldStop?.() ? "NOT SEND - stopped before a voice pack completed." : "NOT SEND - no voice crossed the threshold before maxWaitMs."
      });
    }
    if (audio.size <= 0) {
      return packOutput("skip_empty_audio", null, {
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
        reason: "NOT SEND - recorder produced an empty audio pack."
      });
    }
    if (voiceActiveMs < minVoiceMs) {
      return packOutput("skip_too_short", audio, {
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
        reason: "NOT SEND - voice activity was too short."
      });
    }
    return packOutput("send_voice_segment", audio, {
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
      reason: "SEND - voice crossed the threshold and ended after silence."
    });
  } catch (error) {
    const speech = speechCapture?.stop() || { available: false, text: "", finalDetected: false };
    return {
      status: errorStatus("VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK", startedAt, error),
      decision: "skip_empty_audio",
      audio: null,
      transcript: speech.text,
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
        reason: error instanceof Error ? error.message : String(error),
        browserSpeechAvailable: speech.available,
        browserSpeechFinalDetected: speech.finalDetected,
        browserSpeechText: speech.text
      }
    };
  }
}

export async function VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK(input: {
  settings: VoiceAgentV2Settings;
  audio: Blob;
  visibleHistory: VoiceAgentV2VisibleHistoryItem[];
  onEvent?: (event: VoiceAgentStreamVoiceTurnEvent) => void;
}): Promise<VoiceAgentV2RealtimeVoicePackTurn> {
  const startedAt = new Date().toISOString();
  const events: VoiceAgentStreamVoiceTurnEvent[] = [];
  let correctionEvent: VoiceAgentV2RealtimeCorrectionEvent | undefined;
  try {
    const result = await VOICE_AGENT_STREAM_VOICE_TURN({
      settings: {
        ...input.settings,
        prompts: VOICE_AGENT_V2_CREATE_PROMPTS(input.settings)
      },
      audio: input.audio,
      textUserChat: "",
      history5LastTextChats: input.settings.allowFreeChat ? VOICE_AGENT_V2_VISIBLE_HISTORY_TEXT(input.visibleHistory) : [],
      additionalInstructions: input.settings.allowFreeChat
        ? [
            "This is one user audio pack. Treat it as the current user message.",
            "Free chat is enabled: answer the user's question or request normally.",
            "Do not translate unless the user explicitly asks for translation.",
            "Do not correct unless the user explicitly asks for correction or feedback.",
            "Never react to your own previous audio if it appears in the microphone input."
          ].join("\n")
        : [
            "This is one user audio pack. Answer only this pack.",
            "If you mark the level, use exactly one app signal word at the start: SignalVert, SignalJaune, SignalOrange, or SignalRouge.",
            "A foreign accent is OK when the words are understandable: use SignalVert and do not correct it.",
            "Use SignalJaune only for a concrete pronunciation/accent improvement that improves clarity.",
            "Use SignalOrange for vocabulary or meaning problems.",
            "Use SignalRouge only for a real grammar mistake or severe meaning mistake.",
            "Pronunciation or accent must never be SignalOrange or SignalRouge.",
            "Keep spoken correction text short and natural after the signal word.",
            "Never react to your own previous audio if it appears in the microphone input."
          ].join("\n"),
      onEvent: (event) => {
        events.push(event);
        const eventResult = VOICE_AGENT_V2_REALTIME_EVENT_RESULT(event);
        const eventCorrection = input.settings.allowFreeChat
          ? explicitSignalCorrectionEventFromText(extractRealtimeText(event))
          : eventResult.correctionEvent;
        if (eventCorrection) correctionEvent = eventCorrection;
        input.onEvent?.(event);
      }
    });
    const finalCorrection = correctionEvent || (input.settings.allowFreeChat
      ? explicitSignalCorrectionEventFromText(result.text)
      : VOICE_AGENT_V2_REALTIME_EVENT_RESULT({ type: "done", text: result.text }).correctionEvent);
    return {
      status: result.status.ok
        ? doneStatus("VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK", startedAt)
        : errorStatus("VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK", startedAt, result.status.error || "VOICE_AGENT_STREAM_VOICE_TURN failed."),
      text: result.text,
      audio: result.audio
        ? {
            blob: base64ToAudioBlob(result.audio.audioBase64, result.audio.audioFormat),
            audioFormat: result.audio.audioFormat,
            chunkCount: result.audio.chunkCount
          }
        : null,
      events: result.events.length ? result.events : events,
      request: result.request,
      correctionEvent: finalCorrection || undefined
    };
  } catch (error) {
    return {
      status: errorStatus("VOICE_AGENT_V2_REALTIME_SEND_VOICE_PACK", startedAt, error),
      text: "",
      audio: null,
      events,
      request: null,
      correctionEvent
    };
  }
}

export async function VOICE_AGENT_V2_REALTIME_SERVER_AUDIO_ROUNDTRIP(input: {
  endpoint?: string;
  audio: Blob;
}): Promise<VoiceAgentV2RealtimeAudioRoundtrip> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const endpoint = input.endpoint || "/api/voice-agent/audio-roundtrip";
  const requestContentType = input.audio.type || "application/octet-stream";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": requestContentType
      },
      body: input.audio
    });
    if (!response.ok) throw new Error(await response.text().catch(() => `Audio roundtrip failed with ${response.status}`));
    const audio = await response.blob();
    return {
      status: doneStatus("VOICE_AGENT_V2_REALTIME_SERVER_AUDIO_ROUNDTRIP", startedAt),
      audio,
      debug: {
        endpoint,
        requestContentType,
        requestSize: input.audio.size,
        responseContentType: audio.type || response.headers.get("Content-Type") || "",
        responseSize: audio.size,
        durationMs: Date.now() - startedMs
      }
    };
  } catch (error) {
    return {
      status: errorStatus("VOICE_AGENT_V2_REALTIME_SERVER_AUDIO_ROUNDTRIP", startedAt, error),
      audio: null,
      debug: {
        endpoint,
        requestContentType,
        requestSize: input.audio.size,
        responseContentType: "",
        responseSize: 0,
        durationMs: Date.now() - startedMs
      }
    };
  }
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
  if (canContainAssistantCorrection(eventType)) {
    const correctionEvent = extractCorrectionEvent(event);
    if (correctionEvent) {
      return eventType.includes(".delta")
        ? { type: eventType, correctionEvent, textDelta: correctionEvent.text }
        : { type: eventType, correctionEvent, textDone: correctionEvent.text };
    }
  }
  if (eventType === "text_delta" || eventType === "audio_transcript_delta") {
    const correctionEvent = extractCorrectionEvent(event);
    const text = correctionEvent?.text || extractString(event, ["delta", "transcript", "text"]);
    return correctionEvent ? { type: eventType, correctionEvent, textDelta: text } : { type: eventType, textDelta: text };
  }
  if (eventType === "done") {
    const correctionEvent = extractCorrectionEvent(event);
    const text = correctionEvent?.text || extractRealtimeText(event);
    return correctionEvent ? { type: eventType, aiSpeaking: false, correctionEvent, textDone: text } : { type: eventType, aiSpeaking: false, textDone: text };
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
    "Speak in the target language. If you mark the level, use exactly one app signal word at the start: SignalVert, SignalJaune, SignalOrange, or SignalRouge. Never say the English word Hint.",
    "A foreign accent is OK when the words are understandable: use SignalVert and do not correct it. Use SignalJaune only for a concrete pronunciation/accent improvement that improves clarity. Pronunciation or accent must never be SignalOrange or SignalRouge.",
    "Use SignalOrange for vocabulary or meaning problems, and SignalRouge only for a real grammar mistake or severe meaning mistake. Keep spoken correction text short and natural.",
    settings.allowFreeChat
      ? "Answer the user's question naturally. Correct only when the user asks for correction or clearly practices the language."
      : "For practice speech, say only one corrected phrase and one tiny tip when useful. If there is no useful correction, stay silent or give a very short confirmation.",
    "Example correction: Je suis malade, avec etre.",
    "Do not greet. Do not explain implementation details.",
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

function canContainAssistantCorrection(eventType: string) {
  return (
    eventType === "response.done" ||
    eventType.includes("response.output_text") ||
    eventType.includes("response.output_audio_transcript") ||
    eventType.includes("response.function_call_arguments")
  );
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
  const signalEvent = explicitSignalCorrectionEventFromText(value);
  if (signalEvent) return signalEvent;
  const correction = correctionLevelFromText(value);
  if (correction === null) return null;
  return {
    correction,
    text: cleanCorrectionText(value) || undefined,
    hint: extractCorrectionHint(value) || undefined,
    raw: value
  };
}

function explicitSignalCorrectionEventFromText(value: string): VoiceAgentV2RealtimeCorrectionEvent | null {
  const match = value.match(/^\s*(signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge))\b\s*[:,-]?\s*(.*)$/i);
  if (!match) return null;
  const word = match[1].toLowerCase().replace(/\s+/g, "");
  const correction = word.endsWith("vert") ? 0 : word.endsWith("jaune") ? 1 : word.endsWith("orange") ? 2 : 3;
  return {
    correction,
    text: match[2]?.trim() || undefined,
    hint: undefined,
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
  const signalEvent = explicitSignalCorrectionEventFromText(value);
  if (signalEvent) return signalEvent.correction;
  const text = value.toLowerCase();
  if (/\b(no correction|none|ok)\b/.test(text)) return 0;
  if (/\b(pronunciation|prononciation|accent|small improvement|slight improvement|minor improvement|mispronunciation|mispronounced)\b/.test(text)) return 1;
  if (/\b(vocabulary|vocabulaire|meaning|important improvement|important correction)\b/.test(text)) return 2;
  if (/\b(grammar|grammaire|spelling|orthographe|very wrong)\b/.test(text)) return 3;
  return null;
}

function isCorrectionTextCandidate(value: string) {
  return /\b(signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge)|correction(?:_level)?|level|severity|niveau|grammar|grammaire|spelling|orthographe|pronunciation|prononciation|accent|vocabulary|vocabulaire|meaning|hint|tip|conseil)\b/i.test(
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
    .replace(/^\s*(?:signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge)|grammar|grammaire|spelling|orthographe|pronunciation|prononciation|accent|vocabulary|vocabulaire|meaning)\s*[:=-]?\s*/i, "")
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

async function captureVoicePackAfterStart(input: {
  input: Parameters<typeof VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK>[0];
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
      if (input.input.shouldStop?.() || input.input.shouldSkipSend?.()) {
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
          recorder.onerror = () => reject(new Error("Browser audio pack recording failed."));
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

async function captureVoicePackWithPrebuffer(input: {
  input: Parameters<typeof VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK>[0];
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
    recorder.onerror = () => reject(new Error("Browser audio pack recording failed."));
    recorder.onstop = () => {
      const includeFromMs = speechStartedMs ? speechStartedMs - input.preBufferMs : Date.now();
      const selectedChunks = chunks.filter((chunk, index) => index === 0 || chunk.receivedAtMs >= includeFromMs).map((chunk) => chunk.blob);
      const blob = new Blob(selectedChunks, { type: mimeType });
      input.setSize(blob.size);
      finish(blob);
    };
    recorder.start(250);
    const timer = window.setInterval(() => {
      if (input.input.shouldStop?.() || input.input.shouldSkipSend?.()) {
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

function averageRms(totalRms: number, sampleCount: number) {
  return Number((sampleCount ? totalRms / sampleCount : 0).toFixed(4));
}

function startBrowserSpeechTranscriptCapture(lang = "fr-FR"): BrowserSpeechTranscriptCapture {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    return { stop: () => ({ available: false, text: "", finalDetected: false }) };
  }

  let text = "";
  let finalDetected = false;
  let abortExpected = false;
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    const transcripts: string[] = [];
    for (let index = 0; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();
      if (transcript) transcripts.push(transcript);
      if (event.results[index].isFinal) finalDetected = true;
    }
    text = transcripts.join(" ").trim();
  };
  recognition.onerror = (event) => {
    if (event.error !== "aborted" || !abortExpected) text = text.trim();
  };

  try {
    recognition.start();
  } catch {
    return { stop: () => ({ available: false, text: "", finalDetected: false }) };
  }

  return {
    stop: () => {
      abortExpected = true;
      try {
        recognition.abort();
      } catch {
        // Browser cleanup only.
      }
      return { available: true, text: text.trim(), finalDetected };
    }
  };
}

function voicePackOutput(
  startedAt: string,
  decision: VoiceAgentV2RealtimeVoicePackDecision,
  audio: Blob | null,
  debug: VoiceAgentV2RealtimeVoicePack["debug"],
  transcript = ""
): VoiceAgentV2RealtimeVoicePack {
  return {
    status: doneStatus("VOICE_AGENT_V2_REALTIME_CAPTURE_VOICE_PACK", startedAt),
    decision,
    audio,
    transcript,
    debug
  };
}

function base64ToAudioBlob(base64: string, format: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: format.startsWith("audio/") ? format : `audio/${format}` });
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
