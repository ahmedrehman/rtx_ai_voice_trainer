import type { DebugPageDefinition } from "../debug_page_types";

export const APP_V3_DEBUG_PAGE: DebugPageDefinition = {
  id: "APP_V3_WEBRTC_TEST",
  title: "App V3 WebRTC test",
  module: "app_v3_test",
  role: "debug view of the V3 persistent WebRTC app path plus a server audio roundtrip diagnostic",
  ready: true,
  inputs: [],
  actions: [{ id: "both", label: "Run App V3 WebRTC", requiresAudio: true }],
  output: [
    "persistent RTCPeerConnection state",
    "microphone track enabled/disabled state",
    "remote AI audio element state",
    "realtime data channel events",
    "server audio roundtrip diagnostic"
  ]
};
