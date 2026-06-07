import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_MICRO_TO_AUDIO_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_MICRO_TO_AUDIO",
  title: "Micro to audio",
  module: "lib_client_voice_system_test",
  role: "browser microphone -> raw audio blob",
  ready: true,
  inputs: [
    { key: "durationMs", label: "durationMs", kind: "number", defaultValue: 3000, required: true }
  ],
  actions: [{ id: "audio", label: "Record audio", requiresAudio: true }],
  output: ["status", "audio size", "mimeType", "durationMs"]
};
