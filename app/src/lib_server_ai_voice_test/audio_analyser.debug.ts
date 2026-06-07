import type { DebugPageDefinition } from "../debug_page_types";
import { AUDIO_ANALYSER_PROMPTS, SERVER_AI_PROVIDER_INPUTS } from "./shared";

export const AUDIO_ANALYSER_DEBUG_PAGE: DebugPageDefinition = {
  id: "AUDIO_ANALYSER",
  title: "Audio analyser",
  module: "lib_server_ai_voice_test",
  role: "real method: original audio + text chat + history + prompts -> JSON + AI audio",
  ready: true,
  inputs: [
    ...SERVER_AI_PROVIDER_INPUTS,
    { key: "textUserChat", label: "textUserChat", kind: "textarea", defaultValue: "Bonjour, je veux tester ma voix." },
    { key: "audio", label: "audio", kind: "audio", required: true },
    { key: "history5LastTextChats", label: "history5LastTextChats", kind: "json", defaultValue: "[]" },
    { key: "systemPrompt.task", label: "systemPrompt.task", kind: "textarea", defaultValue: AUDIO_ANALYSER_PROMPTS.task, required: true },
    { key: "systemPrompt.howToRespond", label: "systemPrompt.howToRespond", kind: "textarea", defaultValue: AUDIO_ANALYSER_PROMPTS.howToRespond, required: true },
    { key: "systemPrompt.responseJsonFormat", label: "systemPrompt.responseJsonFormat", kind: "json", defaultValue: AUDIO_ANALYSER_PROMPTS.responseJsonFormat, required: true }
  ],
  actions: [
    { id: "audio", label: "Run audio" },
    { id: "both", label: "Run text + audio", requiresAudio: true }
  ],
  output: ["status", "json.flags", "json.chat_text_to_user", "json.text_corrected", "json.hint", "audio", "debug"]
};
