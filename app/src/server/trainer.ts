import type {
  AppSettings,
  CorrectionInput,
  CorrectionResult,
  CostBucket,
  ProviderId,
  ProviderUsage,
  StructuredCorrection
} from "../types";
import { providerModules, providerSummaries, type TrainerEnv } from "./providerModules";
import { buildSystemPrompt } from "./trainerLogic";

export type { TrainerEnv };
export { providerSummaries };

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

const rates: Record<ProviderId, { stt: number; correction: number; tts: number }> = {
  "browser-demo": { stt: 0, correction: 0, tts: 0 },
  openai: { stt: 0.003, correction: 0.000002, tts: 0.015 },
  "deepgram-elevenlabs": { stt: 0.006, correction: 0.000002, tts: 0.03 },
  azure: { stt: 0.016, correction: 0.000002, tts: 0.016 },
  google: { stt: 0.016, correction: 0.000002, tts: 0.016 }
};

export async function correctUtterance(input: CorrectionInput, env: TrainerEnv): Promise<CorrectionResult> {
  const settings = { ...defaultSettings, ...input.settings };
  const providerId = normalizeProvider(input.providerId);
  const request: CorrectionInput = { ...input, providerId, settings };
  const correction = await providerModules[providerId].correct(request, env);
  const trainerText = correction.notes.length
    ? `${correction.corrected}\n${correction.notes.join(" ")}`
    : correction.corrected;
  const spokenText = voiceText(correction, settings.shortVoiceHints);
  const cost = estimateCost(providerId, {
    inputChars: request.text.length,
    outputChars: trainerText.length,
    usedSpeechInput: request.speechInput,
    usedSpeechOutput: request.voiceOutput
  });

  return {
    providerId,
    correction,
    trainerText,
    spokenText,
    cost,
    debug: {
      systemPrompt: buildSystemPrompt(settings),
      decision: {
        keywordSent: correction.keywordSent,
        shouldRespond: correction.shouldRespond,
        shouldSpeak: correction.shouldRespond && request.voiceOutput,
        trigger: correction.trigger
      }
    }
  };
}

function normalizeProvider(providerId: ProviderId): ProviderId {
  return providerModules[providerId] ? providerId : "browser-demo";
}

function estimateCost(providerId: ProviderId, usage: ProviderUsage): CostBucket {
  const providerRates = rates[providerId] || rates["browser-demo"];
  const inputMinutes = Math.max(0.05, usage.inputChars / 900);
  const outputMinutes = Math.max(0.02, usage.outputChars / 900);
  const sttCost = usage.usedSpeechInput ? inputMinutes * providerRates.stt : 0;
  const correctionCost = Math.max(providerRates.correction === 0 ? 0 : 0.0001, (usage.inputChars + usage.outputChars) * providerRates.correction);
  const ttsCost = usage.usedSpeechOutput ? outputMinutes * providerRates.tts : 0;

  return {
    turns: 1,
    sttCost,
    correctionCost,
    ttsCost,
    estimatedCost: sttCost + correctionCost + ttsCost
  };
}

function voiceText(correction: StructuredCorrection, shortHints: boolean) {
  if (!shortHints || correction.notes.length === 0) {
    return correction.notes.length ? `${correction.corrected}. ${correction.notes[0]}` : correction.corrected;
  }

  return correction.corrected;
}
