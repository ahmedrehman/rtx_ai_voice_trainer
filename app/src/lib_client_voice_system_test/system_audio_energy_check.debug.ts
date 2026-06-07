import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_AUDIO_ENERGY_CHECK_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_AUDIO_ENERGY_CHECK",
  title: "Audio energy check",
  module: "lib_client_voice_system_test",
  role: "public client method that samples microphone RMS energy to skip silence before AI cost",
  ready: true,
  inputs: [
    { key: "durationMs", label: "durationMs", kind: "number", defaultValue: 2000, required: true },
    { key: "threshold", label: "threshold", kind: "number", defaultValue: 0.035, required: true },
    { key: "minActiveMs", label: "minActiveMs", kind: "number", defaultValue: 250, required: true },
    { key: "sampleEveryMs", label: "sampleEveryMs", kind: "number", defaultValue: 50 }
  ],
  actions: [{ id: "audio", label: "Run energy check", requiresAudio: true }],
  output: ["status", "hasSound", "activeMs", "maxRms", "averageRms", "sampleCount"]
};
