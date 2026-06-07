import type { DebugPageDefinition } from "../debug_page_types";
import { SERVER_AI_PROVIDER_INPUTS } from "./shared";

export const PRIMITIVE_TEXT_TO_AUDIO_DEBUG_PAGE: DebugPageDefinition = {
  id: "PRIMITIVE_TEXT_TO_AUDIO",
  title: "Primitive text to audio",
  module: "lib_server_ai_voice_test",
  role: "text -> AI audio using server TTS implementation",
  ready: true,
  inputs: [
    ...SERVER_AI_PROVIDER_INPUTS,
    { key: "text", label: "text", kind: "textarea", defaultValue: "Bonjour. Ceci est un test.", required: true },
    { key: "systemPrompt", label: "systemPrompt", kind: "textarea", defaultValue: "Speak as a calm trainer." },
    { key: "additionalInstructions", label: "additionalInstructions", kind: "textarea", defaultValue: "Keep it short." },
    { key: "history", label: "history", kind: "json", defaultValue: "[]" }
  ],
  actions: [{ id: "text", label: "Run text" }],
  output: ["status", "audioBase64", "contentType", "json", "debug"]
};
