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
