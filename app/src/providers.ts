import type {
  AppSettings,
  CorrectionInput,
  CostBucket,
  ProviderId,
  ProviderUsage,
  StructuredCorrection,
  VoiceTrainerProvider
} from "./types";

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

function cleanKeyword(text: string, keyword: string) {
  return text.replace(new RegExp(`\\b${escapeRegExp(keyword)}\\b[:,]?\\s*`, "i"), "").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function demoCorrect(input: CorrectionInput): StructuredCorrection {
  const normalized = input.text.trim();
  const lowered = normalized.toLowerCase();
  const keyword = input.settings.keyword.trim().toLowerCase() || "computer";
  const keywordSent = lowered.includes(keyword);
  const shouldRespond = input.forced || input.manualText || keywordSent;
  const cleaned = cleanKeyword(normalized, keyword);
  let corrected = cleaned || normalized;
  const notes: string[] = [];

  const replacements: Array<[RegExp, string, string]> = [
    [/\bje suis aller\b/gi, "je suis alle", "Use the past participle after etre."],
    [/\bje vais au bibliotheque\b/gi, "je vais a la bibliotheque", "Bibliotheque is feminine."],
    [/\bje mange une pomme hier\b/gi, "j'ai mange une pomme hier", "Use passe compose for finished past action."],
    [/\bmon mere\b/gi, "ma mere", "Mere is feminine."],
    [/\bun voiture\b/gi, "une voiture", "Voiture is feminine."]
  ];

  for (const [pattern, replacement, note] of replacements) {
    if (pattern.test(corrected)) {
      corrected = corrected.replace(pattern, replacement);
      notes.push(note);
    }
  }

  const visualFeedback = notes.length ? "improvement" : "none";

  if (!notes.length && shouldRespond) {
    notes.push(`No obvious ${input.settings.languageName} correction found in demo mode.`);
  }

  return {
    text: cleaned || normalized,
    corrected,
    keywordSent,
    shouldRespond,
    trigger: input.forced ? "button" : input.manualText ? "manual-text" : keywordSent ? "keyword" : "silent",
    notes,
    visualFeedback,
    topic: input.settings.topic,
    languageName: input.settings.languageName
  };
}

function estimateByMinute(usage: ProviderUsage, rates: { stt: number; correction: number; tts: number }) {
  const inputMinutes = Math.max(0.05, usage.inputChars / 900);
  const outputMinutes = Math.max(0.02, usage.outputChars / 900);
  const sttCost = usage.usedSpeechInput ? inputMinutes * rates.stt : 0;
  const correctionCost = Math.max(0.0001, (usage.inputChars + usage.outputChars) * rates.correction);
  const ttsCost = usage.usedSpeechOutput ? outputMinutes * rates.tts : 0;

  return {
    turns: 1,
    sttCost,
    correctionCost,
    ttsCost,
    estimatedCost: sttCost + correctionCost + ttsCost
  };
}

function provider(
  id: ProviderId,
  name: string,
  role: string,
  pricingNote: string,
  quality: string,
  productionPath: string,
  rates: { stt: number; correction: number; tts: number }
): VoiceTrainerProvider {
  return {
    id,
    name,
    role,
    pricingNote,
    quality,
    productionPath,
    correct: async (input) => demoCorrect(input),
    estimateCost: (usage) => estimateByMinute(usage, rates)
  };
}

export const providers: VoiceTrainerProvider[] = [
  provider(
    "browser-demo",
    "Browser demo",
    "Local prototype",
    "Uses browser speech APIs and demo correction logic. No API cost.",
    "Best for testing the silent workflow before connecting paid services.",
    "Runs fully in the browser. Replace the demo correct function with /api/correct later.",
    { stt: 0, correction: 0, tts: 0 }
  ),
  provider(
    "openai",
    "OpenAI",
    "Realtime or STT + LLM + TTS",
    "Best all-in-one path for structured JSON, correction, and optional speech.",
    "Recommended first production provider.",
    "Cloudflare Worker endpoint should call OpenAI. The browser must not hold the API key.",
    { stt: 0.003, correction: 0.000002, tts: 0.015 }
  ),
  provider(
    "deepgram-elevenlabs",
    "Deepgram + ElevenLabs",
    "Fast STT + high quality TTS",
    "Good if you want separate speech providers and high quality generated voice.",
    "Strong voice quality, more integration work.",
    "Use Deepgram for /api/transcribe and ElevenLabs for /api/speak.",
    { stt: 0.006, correction: 0.000002, tts: 0.03 }
  ),
  provider(
    "azure",
    "Azure Speech",
    "Enterprise speech services",
    "Good for regional controls and enterprise deployment.",
    "Reliable, but heavier setup for a small prototype.",
    "Use Worker secrets for Azure region and API key.",
    { stt: 0.016, correction: 0.000002, tts: 0.016 }
  ),
  provider(
    "google",
    "Google Cloud",
    "Speech and TTS services",
    "Useful if the rest of the stack already uses Google Cloud.",
    "Solid speech infrastructure, separate integration path.",
    "Use Worker service credentials or a backend token exchange.",
    { stt: 0.016, correction: 0.000002, tts: 0.016 }
  )
];

export function getProvider(providerId: ProviderId) {
  return providers.find((item) => item.id === providerId) ?? providers[0];
}

export function voiceText(correction: StructuredCorrection, shortHints: boolean) {
  if (!shortHints || correction.notes.length === 0) {
    return correction.notes.length ? `${correction.corrected}. ${correction.notes[0]}` : correction.corrected;
  }

  return correction.corrected;
}
