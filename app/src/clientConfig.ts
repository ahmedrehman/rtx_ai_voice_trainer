import type { AppSettings, CostBucket, ProviderId, ProviderSummary } from "./types";

const emptyCost: CostBucket = {
  turns: 0,
  estimatedCost: 0,
  sttCost: 0,
  correctionCost: 0,
  ttsCost: 0
};

export const defaultSettings: AppSettings = {
  languageName: "French",
  recognitionLang: "fr-FR",
  topic: "daily conversation",
  keyword: "computer",
  showStructured: true,
  showVisualFeedback: true,
  shortVoiceHints: true
};

export const defaultLedger: Record<ProviderId, CostBucket> = {
  "browser-demo": { ...emptyCost },
  openai: { ...emptyCost },
  "deepgram-elevenlabs": { ...emptyCost },
  azure: { ...emptyCost },
  google: { ...emptyCost }
};

export const providerSummaries: ProviderSummary[] = [
  {
    id: "browser-demo",
    name: "Browser demo",
    role: "Server demo provider",
    pricingNote: "No external API cost.",
    quality: "Best for testing the silent workflow before connecting paid services.",
    productionPath: "Server-side deterministic trainer module."
  },
  {
    id: "openai",
    name: "OpenAI",
    role: "STT + LLM + TTS capable",
    pricingNote: "Uses server-side Worker secrets.",
    quality: "Recommended first production provider.",
    productionPath: "Worker calls OpenAI with OPENAI_API_KEY."
  },
  {
    id: "deepgram-elevenlabs",
    name: "Deepgram + ElevenLabs",
    role: "Fast STT + high quality TTS",
    pricingNote: "Uses server-side Worker secrets.",
    quality: "Strong voice quality, more integration work.",
    productionPath: "Worker calls Deepgram and ElevenLabs."
  },
  {
    id: "azure",
    name: "Azure Speech",
    role: "Enterprise speech services",
    pricingNote: "Uses server-side Worker secrets.",
    quality: "Reliable, but heavier setup for a small prototype.",
    productionPath: "Worker calls Azure Speech services."
  },
  {
    id: "google",
    name: "Google Cloud",
    role: "Speech and TTS services",
    pricingNote: "Uses server-side Worker secrets.",
    quality: "Solid speech infrastructure, separate integration path.",
    productionPath: "Worker calls Google Cloud services."
  }
];
