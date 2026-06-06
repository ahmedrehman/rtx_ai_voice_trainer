export type ClientVoiceSystemTestId =
  | "SYSTEM_MEANINGFUL_AUDIO_CHUNK"
  | "SYSTEM_MICRO_TO_AUDIO"
  | "SYSTEM_AUDIO_TO_TEXT"
  | "SYSTEM_TEXT_TO_AUDIO"
  | "SYSTEM_AUDIO_TO_SPEAKER";

export type ClientVoiceSystemTest = {
  id: ClientVoiceSystemTestId;
  title: string;
  role: string;
  input: string[];
  output: string[];
  prompt: "none";
};

export const CLIENT_VOICE_SYSTEM_TESTS: ClientVoiceSystemTest[] = [
  {
    id: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
    title: "Meaningful audio chunk",
    role: "mic -> useful chunk",
    input: ["microphone", "maxDurationMs", "browser speech checker if available"],
    output: ["audio blob", "chunkReason", "optional browserSpeechText"],
    prompt: "none"
  },
  {
    id: "SYSTEM_MICRO_TO_AUDIO",
    title: "Raw microphone recording",
    role: "mic -> audio file",
    input: ["microphone", "durationMs"],
    output: ["audio blob", "mimeType", "durationMs"],
    prompt: "none"
  },
  {
    id: "SYSTEM_AUDIO_TO_TEXT",
    title: "Browser speech checker",
    role: "browser speech -> text",
    input: ["microphone", "browser SpeechRecognition"],
    output: ["text"],
    prompt: "none"
  },
  {
    id: "SYSTEM_TEXT_TO_AUDIO",
    title: "Browser dummy speak",
    role: "text -> browser voice",
    input: ["text"],
    output: ["played by browser"],
    prompt: "none"
  },
  {
    id: "SYSTEM_AUDIO_TO_SPEAKER",
    title: "Speaker playback",
    role: "audio blob -> speaker",
    input: ["audio blob"],
    output: ["played"],
    prompt: "none"
  }
];

export const CLIENT_VOICE_SYSTEM_DEBUG_PAGES: DebugPageDefinition[] = [
  {
    id: "MICROPHONE_AUDIO_REQUIREMENTS",
    title: "Microphone and audio requirements",
    module: "Client Voice",
    role: "frontend documentation for microphone, audio, permissions, and browser limits",
    ready: true,
    inputs: [],
    actions: [],
    output: ["documentation only"]
  },
  {
    id: "SYSTEM_MEANINGFUL_AUDIO_CHUNK",
    title: "Meaningful audio chunk",
    module: "Client Voice",
    role: "microphone -> useful audio chunk with browser speech checker if available",
    ready: true,
    inputs: [
      { key: "maxDurationMs", label: "maxDurationMs", kind: "number", defaultValue: 5000, required: true },
      { key: "silenceMs", label: "silenceMs", kind: "number", defaultValue: 900 },
      { key: "speechCheckLang", label: "speechCheckLang", kind: "text", defaultValue: "fr-FR" }
    ],
    actions: [{ id: "audio", label: "Create audio chunk", requiresAudio: true }],
    output: ["status", "audio size", "mimeType", "durationMs", "chunkReason", "browserSpeechText"]
  },
  {
    id: "SYSTEM_MICRO_TO_AUDIO",
    title: "Micro to audio",
    module: "Client Voice",
    role: "browser microphone -> raw audio blob",
    ready: true,
    inputs: [
      { key: "durationMs", label: "durationMs", kind: "number", defaultValue: 3000, required: true }
    ],
    actions: [{ id: "audio", label: "Record audio", requiresAudio: true }],
    output: ["status", "audio size", "mimeType", "durationMs"]
  },
  {
    id: "SYSTEM_AUDIO_TO_TEXT",
    title: "Audio to text",
    module: "Client Voice",
    role: "browser SpeechRecognition checker -> text",
    ready: true,
    inputs: [
      { key: "lang", label: "lang", kind: "text", defaultValue: "fr-FR" }
    ],
    actions: [{ id: "audio", label: "Listen with browser checker", requiresAudio: true }],
    output: ["status", "text", "note"]
  },
  {
    id: "SYSTEM_TEXT_TO_AUDIO",
    title: "Text to audio",
    module: "Client Voice",
    role: "text -> browser dummy speech",
    ready: true,
    inputs: [
      { key: "text", label: "text", kind: "textarea", defaultValue: "Bonjour. Ceci est un test.", required: true },
      { key: "lang", label: "lang", kind: "text", defaultValue: "fr-FR" }
    ],
    actions: [{ id: "text", label: "Speak text" }],
    output: ["status", "spoken", "note"]
  },
  {
    id: "SYSTEM_AUDIO_TO_SPEAKER",
    title: "Audio to speaker",
    module: "Client Voice",
    role: "last audio blob -> speaker playback",
    ready: true,
    inputs: [
      { key: "audio", label: "audio", kind: "audio", note: "Uses last recorded/generated audio blob." }
    ],
    actions: [{ id: "audio", label: "Play last audio" }],
    output: ["status", "played"]
  }
];
import type { DebugPageDefinition } from "../../debug_page_types";
