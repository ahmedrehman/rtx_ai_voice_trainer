export type VoiceImplementation = "audio-ai" | "chained" | "dummy";

export type VoiceTrainerSettings = {
  languageName: string;
  recognitionLang: string;
  topic: string;
  keyword: string;
  voiceImplementation: VoiceImplementation;
};

export type VoiceTrainerMode = {
  listenEnabled: boolean;
  speakEnabled: boolean;
  isListening: boolean;
  isTranscribing: boolean;
  isCorrecting: boolean;
  isGeneratingVoice: boolean;
  isPlayingVoice: boolean;
};

export type VoiceTrainerCorrectionRequest = {
  providerId: string;
  text: string;
  answerAllowed: boolean;
  speakEnabled: boolean;
  trigger: "silent" | "button" | "keyword_on" | "keyword_off" | "manual_text";
  history: unknown[];
  settings: VoiceTrainerSettings;
};

export type VoiceTrainerCorrectionResponse = {
  textOriginal: string;
  textClean: string;
  textCorrected: string;
  message: string;
  hint: string;
  keywordOnSent: boolean;
  keywordOffSent: boolean;
  answerAllowed: boolean;
  speakAllowed: boolean;
  trigger: VoiceTrainerCorrectionRequest["trigger"];
  signal: "none" | "improvement" | "error";
  notes: string[];
};

export type VoiceTrainerVoiceRequest = {
  providerId: string;
  text: string;
  voice: string;
  languageName: string;
  style: string;
};

export type VoiceTrainerAudioTurnRequest = {
  providerId: string;
  audioBase64: string;
  audioFormat: "wav" | "mp3" | "webm" | "mp4";
  voice: string;
  settings: VoiceTrainerSettings;
};

export type VoiceTrainerAudioTurnResponse = {
  model: string;
  text: string;
  audioBase64: string;
  audioFormat: "wav" | "mp3";
};

export const voiceImplementationOptions: Array<{
  id: VoiceImplementation;
  label: string;
  description: string;
}> = [
  {
    id: "audio-ai",
    label: "AI audio to audio",
    description: "User audio goes directly to an audio-capable AI model and returns text plus AI audio."
  },
  {
    id: "chained",
    label: "Chained AI voice",
    description: "Speech is transcribed, corrected as text, then converted to provider AI voice."
  },
  {
    id: "dummy",
    label: "Dummy browser voice",
    description: "Browser speech synthesis fallback for quick device checks."
  }
];

export function voiceImplementationLabel(id: VoiceImplementation) {
  return voiceImplementationOptions.find((option) => option.id === id)?.label || id;
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read audio blob"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

export function base64ToAudioBlob(audioBase64: string, format: string) {
  const mimeType = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
  const bytes = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}
