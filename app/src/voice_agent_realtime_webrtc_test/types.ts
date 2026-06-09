export type RealtimeWebrtcStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type RealtimeWebrtcLogEvent = {
  level: "info" | "error";
  method: string;
  message: string;
  data?: unknown;
  createdAt: string;
};

export type RealtimeWebrtcLogger = (event: RealtimeWebrtcLogEvent) => void;

export type RealtimeWebrtcConfig = {
  logger?: RealtimeWebrtcLogger;
};

export type RealtimeWebrtcMicSession = {
  status: RealtimeWebrtcStatus;
  stream: MediaStream | null;
  debug: {
    constraints: MediaStreamConstraints;
  };
};

export type AudioRoundtripRecordOutput = {
  status: RealtimeWebrtcStatus;
  audio: Blob | null;
  debug: {
    durationMs: number;
    mimeType: string;
    size: number;
  };
};

export type AudioRoundtripVoiceSegmentDecision =
  | "send_voice_segment"
  | "skip_no_voice"
  | "skip_too_short"
  | "skip_empty_audio";

export type AudioRoundtripVoiceSegmentOutput = {
  status: RealtimeWebrtcStatus;
  decision: AudioRoundtripVoiceSegmentDecision;
  audio: Blob | null;
  debug: {
    threshold: number;
    silenceMs: number;
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

export type AudioRoundtripServerOutput = {
  status: RealtimeWebrtcStatus;
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

export type RealtimeWebrtcMicMonitorSample = {
  rms: number;
  voiceDetected: boolean;
};

export type RealtimeWebrtcMicMonitor = {
  status: RealtimeWebrtcStatus;
  stop: () => void;
};

export type RealtimeWebrtcConnectionInput = {
  stream: MediaStream;
  clientSecret: string;
  sendToAi: boolean;
  localVoiceDetected: boolean;
  requireLocalVoice: boolean;
  suppressSpeakerFeedback: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
  onEvent?: (event: unknown) => void;
  onState?: (state: RealtimeWebrtcConnectionState) => void;
};

export type RealtimeWebrtcConnectionState = {
  peerState: RTCPeerConnectionState | "none";
  dataChannelState: RTCDataChannelState | "none";
  outgoingMicEnabled: boolean;
  outgoingMicReason: "send_to_ai_off" | "silence" | "ai_speaking" | "enabled";
  localVoiceDetected: boolean;
};

export type RealtimeWebrtcConnection = {
  status: RealtimeWebrtcStatus;
  peer: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  setSendToAi: (sendToAi: boolean) => void;
  setLocalVoiceDetected: (localVoiceDetected: boolean) => void;
  setAiSpeaking: (aiSpeaking: boolean) => void;
  setSuppressSpeakerFeedback: (suppressSpeakerFeedback: boolean) => void;
  stop: () => void;
  debug: {
    endpoint: "POST /v1/realtime/calls";
    sendToAi: boolean;
    suppressSpeakerFeedback: boolean;
  };
};

export type RealtimeWebrtcEventDecision = {
  eventType: string;
  realtimeSpeechDetected?: boolean;
  aiSpeaking?: boolean;
  error?: string;
};
