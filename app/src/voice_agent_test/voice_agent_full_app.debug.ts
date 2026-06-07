import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_FULL_APP_DEBUG_PAGE: DebugPageDefinition = {
  id: "APP_FULL_TEST",
  title: "Full app test",
  module: "voice_agent_test",
  role: "same voice-agent app flow with listen toggle, speak toggle, chat, and full business/debug details",
  ready: true,
  inputs: [
    {
      key: "topic",
      label: "topic",
      kind: "select",
      defaultValue: "french_for_german",
      options: ["french_for_german", "history", "custom"],
      note: "Client topic controls prompts and language settings."
    },
    {
      key: "listenEnabled",
      label: "listenEnabled",
      kind: "select",
      defaultValue: "false",
      options: ["false", "true"],
      note: "When enabled, the app records chunks and sends useful chunks to AUDIO_ANALYSER."
    },
    {
      key: "speakEnabled",
      label: "speakEnabled",
      kind: "select",
      defaultValue: "false",
      options: ["false", "true"],
      note: "When enabled, returned AI audio can be played."
    },
    {
      key: "textUserChat",
      label: "textUserChat",
      kind: "textarea",
      defaultValue: "Bonjour.",
      note: "Typed chat input for the same app flow."
    }
  ],
  actions: [
    { id: "text", label: "Send text chat" },
    { id: "audio", label: "Listen / sample audio", requiresAudio: true },
    { id: "both", label: "Text + audio flow", requiresAudio: true }
  ],
  output: [
    "chat messages",
    "improvement/error lamp",
    "listen/speak state",
    "business sequence",
    "real request",
    "real response",
    "technical log items"
  ]
};
