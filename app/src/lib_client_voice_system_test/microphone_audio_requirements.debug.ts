import type { DebugPageDefinition } from "../debug_page_types";

export const MICROPHONE_AUDIO_REQUIREMENTS_DEBUG_PAGE: DebugPageDefinition = {
  id: "MICROPHONE_AUDIO_REQUIREMENTS",
  title: "Microphone and audio requirements",
  module: "lib_client_voice_system_test",
  role: "frontend documentation for microphone, audio, permissions, and browser limits",
  ready: true,
  inputs: [],
  actions: [],
  output: ["documentation only"]
};
