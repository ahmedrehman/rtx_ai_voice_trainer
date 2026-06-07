import { AUDIO_ANALYSER_DEFAULT_PROMPTS } from "../lib_server_ai_voice/audioAnalyserPrompts";
import { AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS } from "../lib_server_ai_voice/audioTurnPrompts";

export const SERVER_AI_PROVIDER_INPUTS = [
  { key: "provider", label: "provider", kind: "select" as const, defaultValue: "openai", options: ["openai"], required: true },
  { key: "voice", label: "voice", kind: "text" as const, defaultValue: "coral" }
];

export const AUDIO_TURN_PROMPT_INPUTS = [
  { key: "systemPrompt", label: "systemPrompt", kind: "textarea" as const, defaultValue: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.systemPrompt, required: true },
  { key: "taskPrompt", label: "taskPrompt", kind: "textarea" as const, defaultValue: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.taskPrompt, required: true },
  { key: "responseJsonFormat", label: "responseJsonFormat", kind: "json" as const, defaultValue: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.responseJsonFormat, required: true }
];

export const AUDIO_ANALYSER_PROMPTS = AUDIO_ANALYSER_DEFAULT_PROMPTS;
