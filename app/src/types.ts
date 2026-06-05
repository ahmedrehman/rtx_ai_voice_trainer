export type ProviderId = "browser-demo" | "openai" | "deepgram-elevenlabs" | "azure" | "google";

export type Tab = "chat" | "info" | "settings";

export type Trigger = "keyword" | "button" | "manual-text" | "silent";

export type AppSettings = {
  languageName: string;
  recognitionLang: string;
  topic: string;
  keyword: string;
  showStructured: boolean;
  showVisualFeedback: boolean;
  shortVoiceHints: boolean;
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
  text: string;
  forced: boolean;
  manualText: boolean;
  history: ChatMessage[];
  settings: AppSettings;
};

export type VoiceTrainerProvider = {
  id: ProviderId;
  name: string;
  role: string;
  pricingNote: string;
  quality: string;
  productionPath: string;
  correct: (input: CorrectionInput) => Promise<StructuredCorrection>;
  estimateCost: (usage: ProviderUsage) => CostBucket;
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
