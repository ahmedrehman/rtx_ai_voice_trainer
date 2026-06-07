import type { DebugPageDefinition } from "../debug_page_types";
import { AUDIO_TURN_PROMPT_INPUTS, SERVER_AI_PROVIDER_INPUTS } from "./shared";

export const AUDIO_TO_AI_TEXT_AND_AUDIO_DEBUG_PAGE: DebugPageDefinition = {
  id: "AUDIO_TO_AI_TEXT_AND_AUDIO",
  title: "Audio to AI text and audio",
  module: "lib_server_ai_voice_test",
  role: "original audio + prompts -> AI text + AI audio",
  ready: true,
  inputs: [
    ...SERVER_AI_PROVIDER_INPUTS,
    { key: "audio", label: "audio", kind: "audio", required: true },
    ...AUDIO_TURN_PROMPT_INPUTS
  ],
  actions: [{ id: "audio", label: "Run audio AI", requiresAudio: true }],
  output: ["status", "model", "text", "audioBase64", "audioFormat", "debug.promptSent"]
};
