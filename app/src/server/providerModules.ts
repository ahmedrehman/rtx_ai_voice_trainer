import type { CorrectionInput, ProviderId, ProviderSummary, StructuredCorrection } from "../types";
import { callOpenAiCorrectionJson } from "../mod_ai_calls";
import { buildSystemPrompt, demoCorrect, parseCorrection } from "./trainerLogic";

export type TrainerEnv = {
  OPENAI_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  AZURE_SPEECH_KEY?: string;
  AZURE_SPEECH_REGION?: string;
  GOOGLE_CLOUD_API_KEY?: string;
};

export type ProviderModule = {
  summary: ProviderSummary;
  correct: (input: CorrectionInput, env: TrainerEnv) => Promise<StructuredCorrection>;
};

export const providerModules: Record<ProviderId, ProviderModule> = {
  "browser-demo": {
    summary: {
      id: "browser-demo",
      name: "Demo mode",
      role: "Free test mode",
      pricingNote: "No paid API calls.",
      quality: "Checks only a few built-in example mistakes.",
      productionPath: "Use this only to test the app controls."
    },
    correct: async (input) => demoCorrect(input)
  },
  openai: {
    summary: {
      id: "openai",
      name: "OpenAI",
      role: "Real AI corrections",
      pricingNote: "Uses your OpenAI API key.",
      quality: "Best default for real correction quality.",
      productionPath: "Costs money based on OpenAI usage."
    },
    correct: correctWithOpenAI
  },
  "deepgram-elevenlabs": {
    summary: {
      id: "deepgram-elevenlabs",
      name: "Deepgram + ElevenLabs",
      role: "Speech input + high quality voice",
      pricingNote: "Uses Deepgram and ElevenLabs keys.",
      quality: "For stronger speech and spoken output.",
      productionPath: "Costs money on those services."
    },
    correct: async (input, env) => {
      if (!env.DEEPGRAM_API_KEY || !env.ELEVENLABS_API_KEY) {
        return notConfigured(input, "Deepgram + ElevenLabs");
      }
      return demoCorrect(input);
    }
  },
  azure: {
    summary: {
      id: "azure",
      name: "Azure Speech",
      role: "Microsoft speech services",
      pricingNote: "Uses Azure Speech key and region.",
      quality: "Useful if you already use Azure.",
      productionPath: "Costs money on Azure."
    },
    correct: async (input, env) => {
      if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
        return notConfigured(input, "Azure Speech");
      }
      return demoCorrect(input);
    }
  },
  google: {
    summary: {
      id: "google",
      name: "Google Cloud",
      role: "Google speech services",
      pricingNote: "Uses Google Cloud API key.",
      quality: "Useful if you already use Google Cloud.",
      productionPath: "Costs money on Google Cloud."
    },
    correct: async (input, env) => {
      if (!env.GOOGLE_CLOUD_API_KEY) {
        return notConfigured(input, "Google Cloud");
      }
      return demoCorrect(input);
    }
  }
};

export const providerSummaries = Object.values(providerModules).map((provider) => provider.summary);

async function correctWithOpenAI(input: CorrectionInput, env: TrainerEnv): Promise<StructuredCorrection> {
  if (!env.OPENAI_API_KEY) {
    return notConfigured(input, "OpenAI");
  }

  try {
    const result = await callOpenAiCorrectionJson(
      { openAiApiKey: env.OPENAI_API_KEY },
      {
        model: "gpt-4.1-mini",
        systemPrompt: buildSystemPrompt(input.settings),
        taskPrompt: [
          "Correct the learner text.",
          "Return JSON only.",
          "Do not decide app state.",
          "Do not add extra fields.",
          "Keep notes short."
        ].join("\n"),
        userPayload: input
      }
    );
    const raw = result.rawText;
    if (!raw.trim()) {
      return providerError(input, `OpenAI correction returned no text. Raw response keys: ${Object.keys(result.rawResponse as Record<string, unknown>).join(", ")}`);
    }
    return {
      ...parseCorrection(raw, input),
      __providerDebug: result.providerDebug
    } as StructuredCorrection & { __providerDebug: unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI correction failed";
    let providerDebug: unknown;
    try {
      providerDebug = JSON.parse(message);
    } catch {
      providerDebug = { error: message };
    }
    return {
      ...providerError(input, message),
      __providerDebug: providerDebug
    } as StructuredCorrection & { __providerDebug: unknown };
  }
}

function providerError(input: CorrectionInput, message: string): StructuredCorrection {
  return {
    text: input.text,
    corrected: input.text,
    keywordSent: false,
    shouldRespond: true,
    trigger: input.forced ? "button" : input.manualText ? "manual-text" : "silent",
    notes: [message],
    visualFeedback: "error",
    topic: input.settings.topic,
    languageName: input.settings.languageName
  };
}

function notConfigured(input: CorrectionInput, providerName: string): StructuredCorrection {
  const base = demoCorrect(input);
  return {
    ...base,
    shouldRespond: true,
    trigger: input.forced ? "button" : input.manualText ? "manual-text" : base.trigger,
    notes: [
      `${providerName} is not connected.`
    ],
    visualFeedback: "error"
  };
}
