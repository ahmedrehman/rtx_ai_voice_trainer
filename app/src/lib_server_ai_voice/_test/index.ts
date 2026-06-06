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
