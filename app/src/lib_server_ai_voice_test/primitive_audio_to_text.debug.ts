import type { DebugPageDefinition } from "../debug_page_types";
import { SERVER_AI_PROVIDER_INPUTS } from "./shared";

export const PRIMITIVE_AUDIO_TO_TEXT_DEBUG_PAGE: DebugPageDefinition = {
  id: "PRIMITIVE_AUDIO_TO_TEXT",
  title: "Primitive audio to text",
  module: "lib_server_ai_voice_test",
  role: "audio -> transcript only, no pronunciation judgement",
  ready: true,
  inputs: [
    ...SERVER_AI_PROVIDER_INPUTS,
    { key: "audio", label: "audio", kind: "audio", required: true },
    { key: "systemPrompt", label: "systemPrompt", kind: "textarea", defaultValue: "" },
    { key: "additionalInstructions", label: "additionalInstructions", kind: "textarea", defaultValue: "" },
    { key: "textChat", label: "textChat", kind: "textarea", defaultValue: "" },
    { key: "history", label: "history", kind: "json", defaultValue: "[]" }
  ],
  actions: [{ id: "audio", label: "Run audio", requiresAudio: true }],
  output: ["status", "json.text", "json.hint", "debug"]
};
