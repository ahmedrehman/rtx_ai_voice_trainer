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
