import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_TEXT_TO_AUDIO_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_TEXT_TO_AUDIO",
  title: "Text to audio",
  module: "lib_client_voice_system_test",
  role: "text -> browser dummy speech",
  ready: true,
  inputs: [
    { key: "text", label: "text", kind: "textarea", defaultValue: "Bonjour. Ceci est un test.", required: true },
    { key: "lang", label: "lang", kind: "text", defaultValue: "fr-FR" }
  ],
  actions: [{ id: "text", label: "Speak text" }],
  output: ["status", "spoken", "note"]
};
