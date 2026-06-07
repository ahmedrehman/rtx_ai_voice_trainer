import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_MEANINGFUL_AUDIO_CHUNK_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
  title: "Meaningful audio chunk",
  module: "lib_client_voice_system_test",
  role: "microphone -> useful audio chunk with selectable browser speech text or audio energy decision",
  ready: true,
  inputs: [
    { key: "maxDurationMs", label: "maxDurationMs", kind: "number", defaultValue: 5000, required: true },
    { key: "silenceMs", label: "silenceMs", kind: "number", defaultValue: 900 },
    { key: "speechCheckLang", label: "speechCheckLang", kind: "text", defaultValue: "fr-FR" },
    { key: "chunkDecisionMode", label: "chunkDecisionMode", kind: "select", defaultValue: "auto" },
    { key: "energyThreshold", label: "energyThreshold", kind: "number", defaultValue: 0.035 },
    { key: "minEnergyActiveMs", label: "minEnergyActiveMs", kind: "number", defaultValue: 250 }
  ],
  actions: [{ id: "audio", label: "Create audio chunk", requiresAudio: true }],
  output: ["status", "audio size", "mimeType", "durationMs", "chunkReason", "browserSpeechText", "energyCheck", "USEFUL_CHUNK"]
};
