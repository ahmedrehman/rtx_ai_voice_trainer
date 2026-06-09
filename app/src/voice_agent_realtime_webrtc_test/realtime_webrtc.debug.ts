import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_REALTIME_WEBRTC_DEBUG_PAGE: DebugPageDefinition = {
  id: "VOICE_AGENT_REALTIME_WEBRTC_TEST",
  title: "Voice agent realtime WebRTC",
  module: "voice_agent_realtime_webrtc_test",
  role: "browser microphone -> WebRTC realtime speech-to-speech session -> remote audio playback, with mic voice indicator and speaker feedback gate",
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
    "send-to-AI gate state",
    "speaker feedback suppression state",
    "WebRTC connection state",
    "Realtime data channel events",
    "remote audio playback state",
    "errors"
  ]
};
