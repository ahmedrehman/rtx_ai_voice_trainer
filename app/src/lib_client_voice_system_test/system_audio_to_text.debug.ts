import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_AUDIO_TO_TEXT_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_AUDIO_TO_TEXT",
  title: "Audio to text",
  module: "lib_client_voice_system_test",
  role: "browser SpeechRecognition checker -> text",
  ready: true,
  inputs: [
    { key: "lang", label: "lang", kind: "text", defaultValue: "fr-FR" },
    { key: "timeoutMs", label: "timeoutMs", kind: "number", defaultValue: 6000 }
  ],
  actions: [{ id: "audio", label: "Listen with browser checker", requiresAudio: true }],
  output: ["status", "text", "note"]
};
