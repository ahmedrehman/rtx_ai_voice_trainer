import type { DebugPageDefinition } from "../../debug_page_types";
import { AUDIO_ANALYSER_DEFAULT_PROMPTS } from "../audioAnalyserPrompts";

export type ServerAiVoiceTestId =
  | "PRIMITIVE_TEXT_TO_AUDIO"
  | "PRIMITIVE_AUDIO_TO_TEXT"
  | "AUDIO_TO_AI_TEXT_AND_AUDIO"
  | "AUDIO_ANALYSER";

export type ServerAiVoiceTest = {
  id: ServerAiVoiceTestId;
  title: string;
  role: string;
  endpoint: string;
  input: string[];
  output: string[];
  prompt: "none" | "systemPrompt + taskPrompt + responseJsonFormat";
};

export const SERVER_AI_VOICE_TESTS: ServerAiVoiceTest[] = [
  {
    id: "PRIMITIVE_TEXT_TO_AUDIO",
    title: "Primitive text to audio",
    role: "text -> AI audio",
    endpoint: "/api/speak",
    input: ["provider", "text", "optional style"],
    output: ["audio"],
    prompt: "none"
  },
  {
    id: "PRIMITIVE_AUDIO_TO_TEXT",
    title: "Primitive audio to text",
    role: "audio -> transcript text",
    endpoint: "/api/transcribe",
    input: ["browser microphone audio upload"],
    output: ["{ text }"],
    prompt: "none"
  },
  {
    id: "AUDIO_TO_AI_TEXT_AND_AUDIO",
    title: "Audio AI turn",
    role: "original audio -> AI text + AI audio",
    endpoint: "/api/audio-turn",
    input: ["base64 microphone audio", "systemPrompt", "taskPrompt", "responseJsonFormat"],
    output: ["{ model, text, audioBase64, audioFormat }"],
    prompt: "systemPrompt + taskPrompt + responseJsonFormat"
  },
  {
    id: "AUDIO_ANALYSER",
    title: "Audio analyser",
    role: "original audio + chat + history -> JSON + AI audio",
    endpoint: "/api/audio-analyser",
    input: ["original microphone audio", "text user chat", "history", "system prompt object"],
    output: ["json flags/message/correction/hint", "AI audio"],
    prompt: "systemPrompt + taskPrompt + responseJsonFormat"
  }
];

const providerInputs = [
  { key: "provider", label: "provider", kind: "select" as const, defaultValue: "openai", options: ["openai"], required: true },
  { key: "voice", label: "voice", kind: "text" as const, defaultValue: "coral" }
];

const promptInputs = [
  { key: "systemPrompt", label: "systemPrompt", kind: "textarea" as const, defaultValue: "You are a short voice trainer. Use original audio when audio is supplied.", required: true },
  { key: "taskPrompt", label: "taskPrompt", kind: "textarea" as const, defaultValue: "Return short feedback and keep the answer testable.", required: true },
  { key: "responseJsonFormat", label: "responseJsonFormat", kind: "json" as const, defaultValue: "{\n  \"flags\": {},\n  \"chat_text_to_user\": \"\",\n  \"text_corrected\": \"\",\n  \"hint\": \"\"\n}", required: true }
];

export const SERVER_AI_VOICE_DEBUG_PAGES: DebugPageDefinition[] = [
  {
    id: "PRIMITIVE_TEXT_TO_AUDIO",
    title: "Primitive text to audio",
    module: "Server AI Voice",
    role: "text -> AI audio using server TTS implementation",
    ready: true,
    inputs: [
      ...providerInputs,
      { key: "text", label: "text", kind: "textarea", defaultValue: "Bonjour. Ceci est un test.", required: true },
      { key: "systemPrompt", label: "systemPrompt", kind: "textarea", defaultValue: "Speak as a calm trainer." },
      { key: "additionalInstructions", label: "additionalInstructions", kind: "textarea", defaultValue: "Keep it short." },
      { key: "history", label: "history", kind: "json", defaultValue: "[]" }
    ],
    actions: [{ id: "text", label: "Run text" }],
    output: ["status", "audioBase64", "contentType", "json", "debug"]
  },
  {
    id: "PRIMITIVE_AUDIO_TO_TEXT",
    title: "Primitive audio to text",
    module: "Server AI Voice",
    role: "audio -> transcript only, no pronunciation judgement",
    ready: true,
    inputs: [
      ...providerInputs,
      { key: "audio", label: "audio", kind: "audio", required: true },
      { key: "systemPrompt", label: "systemPrompt", kind: "textarea", defaultValue: "" },
      { key: "additionalInstructions", label: "additionalInstructions", kind: "textarea", defaultValue: "" },
      { key: "textChat", label: "textChat", kind: "textarea", defaultValue: "" },
      { key: "history", label: "history", kind: "json", defaultValue: "[]" }
    ],
    actions: [{ id: "audio", label: "Run audio", requiresAudio: true }],
    output: ["status", "json.text", "json.hint", "debug"]
  },
  {
    id: "AUDIO_TO_AI_TEXT_AND_AUDIO",
    title: "Audio to AI text and audio",
    module: "Server AI Voice",
    role: "original audio + prompts -> AI text + AI audio",
    ready: true,
    inputs: [
      ...providerInputs,
      { key: "audio", label: "audio", kind: "audio", required: true },
      ...promptInputs
    ],
    actions: [{ id: "audio", label: "Run audio AI", requiresAudio: true }],
    output: ["status", "model", "text", "audioBase64", "audioFormat", "debug.promptSent"]
  },
  {
    id: "AUDIO_ANALYSER",
    title: "Audio analyser",
    module: "Server AI Voice",
    role: "real method: original audio + text chat + history + prompts -> JSON + AI audio",
    ready: true,
    inputs: [
      ...providerInputs,
      { key: "textUserChat", label: "textUserChat", kind: "textarea", defaultValue: "Bonjour, je veux tester ma voix." },
      { key: "audio", label: "audio", kind: "audio", required: true },
      { key: "history5LastTextChats", label: "history5LastTextChats", kind: "json", defaultValue: "[]" },
      { key: "systemPrompt.task", label: "systemPrompt.task", kind: "textarea", defaultValue: AUDIO_ANALYSER_DEFAULT_PROMPTS.task, required: true },
      { key: "systemPrompt.howToRespond", label: "systemPrompt.howToRespond", kind: "textarea", defaultValue: AUDIO_ANALYSER_DEFAULT_PROMPTS.howToRespond, required: true },
      { key: "systemPrompt.responseJsonFormat", label: "systemPrompt.responseJsonFormat", kind: "json", defaultValue: AUDIO_ANALYSER_DEFAULT_PROMPTS.responseJsonFormat, required: true }
    ],
    actions: [
      { id: "audio", label: "Run audio" },
      { id: "both", label: "Run text + audio", requiresAudio: true }
    ],
    output: ["status", "json.flags", "json.chat_text_to_user", "json.text_corrected", "json.hint", "audio", "debug"]
  }
];
