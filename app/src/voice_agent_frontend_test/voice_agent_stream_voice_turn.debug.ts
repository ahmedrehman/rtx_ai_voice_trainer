import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_STREAM_VOICE_TURN_DEBUG_PAGE: DebugPageDefinition = {
  id: "VOICE_AGENT_STREAM_VOICE_TURN_TEST",
  title: "Voice agent streaming voice turn",
  module: "voice_agent_frontend_test",
  role: "audio input -> provider stream -> text deltas + audio deltas -> final assembled audio playback",
  ready: true,
  inputs: [
    {
      key: "audio",
      label: "audio",
      kind: "audio",
      required: true,
      note: "Original user audio. Default test sample is used when no file is selected."
    },
    {
      key: "textUserChat",
      label: "textUserChat",
      kind: "textarea",
      defaultValue: "",
      note: "Optional typed context for the same turn."
    },
    {
      key: "history5LastTextChats",
      label: "history5LastTextChats",
      kind: "json",
      defaultValue: "[]",
      note: "Last five text chats. Context only."
    }
  ],
  actions: [
    {
      id: "audio",
      label: "Run streaming voice turn",
      requiresAudio: true
    }
  ],
  output: [
    "status",
    "start event",
    "provider_start event",
    "text_delta events",
    "audio_delta events",
    "done event",
    "final text",
    "final assembled audio",
    "errors"
  ]
};
