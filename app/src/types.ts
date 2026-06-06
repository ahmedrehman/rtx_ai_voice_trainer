export type ProviderId = "browser-demo" | "openai" | "deepgram-elevenlabs" | "azure" | "google";

export type Tab = "chat" | "settings" | "debug";

export type Trigger = "keyword" | "button" | "manual-text" | "silent";

import type { VoiceImplementation } from "./voiceTrainer";

export type { VoiceImplementation };

export type AppSettings = {
  languageName: string;
  recognitionLang: string;
  topic: string;
  keyword: string;
  voiceImplementation: VoiceImplementation;
};

export type StructuredCorrection = {
  text: string;
  corrected: string;
  keywordSent: boolean;
  shouldRespond: boolean;
  trigger: Trigger;
  notes: string[];
  visualFeedback: "none" | "improvement" | "error";
  topic: string;
  languageName: string;
};

export type ChatMessage = {
  id: string;
  speaker: "learner" | "trainer" | "system";
  text: string;
  correction?: StructuredCorrection;
  spoken: boolean;
  createdAt: string;
};

export type ProviderUsage = {
  inputChars: number;
  outputChars: number;
  usedSpeechInput: boolean;
  usedSpeechOutput: boolean;
};

export type CostBucket = {
  turns: number;
  estimatedCost: number;
  sttCost: number;
  correctionCost: number;
  ttsCost: number;
};

export type CostLedger = Record<ProviderId, CostBucket>;

export type CorrectionInput = {
  providerId: ProviderId;
  text: string;
  forced: boolean;
  manualText: boolean;
  speechInput: boolean;
  voiceOutput: boolean;
  history: ChatMessage[];
  settings: AppSettings;
};

export type CorrectionResult = {
  providerId: ProviderId;
  correction: StructuredCorrection;
  trainerText: string;
  spokenText: string;
  cost: CostBucket;
  debug: {
    systemPrompt: string;
    decision: {
      keywordSent: boolean;
      shouldRespond: boolean;
      shouldSpeak: boolean;
      trigger: Trigger;
    };
  };
  providerDebug?: unknown;
};

export type ProviderSummary = {
  id: ProviderId;
  name: string;
  role: string;
  pricingNote: string;
  quality: string;
  productionPath: string;
};

export type DebugEvent = {
  id: string;
  createdAt: string;
  providerId: ProviderId;
  systemPrompt: string;
  request: CorrectionInput;
  decision: {
    keywordSent: boolean;
    shouldRespond: boolean;
    shouldSpeak: boolean;
    trigger: Trigger;
  };
  response: StructuredCorrection;
  providerDebug?: unknown;
};

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};
