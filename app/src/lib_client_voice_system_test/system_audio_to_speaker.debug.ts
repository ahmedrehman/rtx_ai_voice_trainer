import type { DebugPageDefinition } from "../debug_page_types";

export const SYSTEM_AUDIO_TO_SPEAKER_DEBUG_PAGE: DebugPageDefinition = {
  id: "SYSTEM_AUDIO_TO_SPEAKER",
  title: "Audio to speaker",
  module: "lib_client_voice_system_test",
  role: "last audio blob -> speaker playback",
  ready: true,
  inputs: [
    { key: "audio", label: "audio", kind: "audio", note: "Uses last recorded/generated audio blob." }
  ],
  actions: [{ id: "audio", label: "Play last audio" }],
  output: ["status", "played"]
};
