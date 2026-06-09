import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_REALTIME_WEBRTC_DEBUG_PAGE: DebugPageDefinition = {
  id: "VOICE_AGENT_REALTIME_WEBRTC_TEST",
  title: "Voice agent realtime WebRTC",
  module: "voice_agent_realtime_webrtc_test",
  role: "two audio trips: browser microphone -> server -> browser playback, or browser microphone -> realtime AI -> browser playback",
  ready: true,
  inputs: [
    {
      key: "sendToAi",
      label: "sendToAi",
      kind: "select",
      defaultValue: "false",
      options: ["false", "true"],
      note: "When false, microphone is monitored locally but the outgoing WebRTC audio track is disabled."
    },
    {
      key: "audioRoundtripEndpoint",
      label: "audioRoundtripEndpoint",
      kind: "text",
      defaultValue: "/api/voice-agent/audio-roundtrip",
      note: "Server echo endpoint used when sendToAi is false."
    },
    {
      key: "suppressSpeakerFeedback",
      label: "suppressSpeakerFeedback",
      kind: "select",
      defaultValue: "true",
      options: ["true", "false"],
      note: "When true, outgoing microphone track is disabled while remote AI audio is playing."
    },
    {
      key: "endpoint",
      label: "endpoint",
      kind: "text",
      defaultValue: "/api/voice-agent/realtime-client-secret",
      note: "Server endpoint that mints an OpenAI Realtime client secret. This endpoint must be wired separately."
    }
  ],
  actions: [
    {
      id: "audio",
      label: "Start realtime WebRTC proof",
      requiresAudio: true
    }
  ],
  output: [
    "microphone permission result",
    "local voice/no voice indicator",
    "server audio roundtrip request/response",
    "server-returned audio playback",
    "send-to-AI gate state",
    "speaker feedback suppression state",
    "WebRTC connection state",
    "Realtime data channel events",
    "remote audio playback state",
    "errors"
  ]
};
