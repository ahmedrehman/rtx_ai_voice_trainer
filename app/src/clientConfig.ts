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
  voiceImplementation: "chained"
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
    name: "Demo mode",
    role: "Free test mode",
    pricingNote: "No paid API calls.",
    quality: "Checks only a few built-in example mistakes.",
    productionPath: "Use this only to test the app controls."
  },
  {
    id: "openai",
    name: "OpenAI",
    role: "Real AI corrections",
    pricingNote: "Uses your OpenAI API key.",
    quality: "Best default for real correction quality.",
    productionPath: "Costs money based on OpenAI usage."
  },
  {
    id: "deepgram-elevenlabs",
    name: "Deepgram + ElevenLabs",
    role: "Speech input + high quality voice",
    pricingNote: "Uses Deepgram and ElevenLabs keys.",
    quality: "For stronger speech and spoken output.",
    productionPath: "Costs money on those services."
  },
  {
    id: "azure",
    name: "Azure Speech",
    role: "Microsoft speech services",
    pricingNote: "Uses Azure Speech key and region.",
    quality: "Useful if you already use Azure.",
    productionPath: "Costs money on Azure."
  },
  {
    id: "google",
    name: "Google Cloud",
    role: "Google speech services",
    pricingNote: "Uses Google Cloud API key.",
    quality: "Useful if you already use Google Cloud.",
    productionPath: "Costs money on Google Cloud."
  }
];
