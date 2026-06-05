import type { CorrectionInput, ProviderId, ProviderSummary, StructuredCorrection } from "../types";
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
      name: "Browser demo",
      role: "Server demo provider",
      pricingNote: "No external API cost.",
      quality: "Best for testing the silent workflow before connecting paid services.",
      productionPath: "Server-side deterministic trainer module."
    },
    correct: async (input) => demoCorrect(input)
  },
  openai: {
    summary: {
      id: "openai",
      name: "OpenAI",
      role: "Realtime or STT + LLM + TTS capable",
      pricingNote: "Uses OPENAI_API_KEY only on the server.",
      quality: "Recommended first production provider.",
      productionPath: "Server module calls OpenAI Responses API."
    },
    correct: correctWithOpenAI
  },
  "deepgram-elevenlabs": {
    summary: {
      id: "deepgram-elevenlabs",
      name: "Deepgram + ElevenLabs",
      role: "Deepgram STT + correction module + ElevenLabs TTS",
      pricingNote: "Uses DEEPGRAM_API_KEY and ELEVENLABS_API_KEY only on the server.",
      quality: "Strong voice quality, more integration work.",
      productionPath: "Server module owns Deepgram/ElevenLabs credentials and cost tracking."
    },
    correct: async (input, env) => {
      if (!env.DEEPGRAM_API_KEY || !env.ELEVENLABS_API_KEY) {
        return notConfigured(input, "Deepgram + ElevenLabs", ["DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY"]);
      }
      return demoCorrect(input);
    }
  },
  azure: {
    summary: {
      id: "azure",
      name: "Azure Speech",
      role: "Enterprise speech services",
      pricingNote: "Uses AZURE_SPEECH_KEY and AZURE_SPEECH_REGION only on the server.",
      quality: "Reliable, but heavier setup for a small prototype.",
      productionPath: "Server module owns Azure Speech credentials and cost tracking."
    },
    correct: async (input, env) => {
      if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
        return notConfigured(input, "Azure Speech", ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]);
      }
      return demoCorrect(input);
    }
  },
  google: {
    summary: {
      id: "google",
      name: "Google Cloud",
      role: "Speech and TTS services",
      pricingNote: "Uses GOOGLE_CLOUD_API_KEY only on the server.",
      quality: "Solid speech infrastructure, separate integration path.",
      productionPath: "Server module owns Google Cloud credentials and cost tracking."
    },
    correct: async (input, env) => {
      if (!env.GOOGLE_CLOUD_API_KEY) {
        return notConfigured(input, "Google Cloud", ["GOOGLE_CLOUD_API_KEY"]);
      }
      return demoCorrect(input);
    }
  }
};

export const providerSummaries = Object.values(providerModules).map((provider) => provider.summary);

async function correctWithOpenAI(input: CorrectionInput, env: TrainerEnv): Promise<StructuredCorrection> {
  if (!env.OPENAI_API_KEY) {
    return notConfigured(input, "OpenAI", ["OPENAI_API_KEY"]);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: buildSystemPrompt(input.settings) },
        { role: "user", content: JSON.stringify(input) }
      ],
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI correction failed with ${response.status}`);
  }

  const data = await response.json() as { output_text?: string };
  return parseCorrection(data.output_text || "", input);
}

function notConfigured(input: CorrectionInput, providerName: string, secrets: string[]): StructuredCorrection {
  const base = demoCorrect(input);
  return {
    ...base,
    shouldRespond: true,
    trigger: input.forced ? "button" : input.manualText ? "manual-text" : base.trigger,
    notes: [
      `${providerName} is selected, but server secrets are not configured: ${secrets.join(", ")}.`,
      "The key names are not exposed to the browser and must be configured on the server."
    ],
    visualFeedback: "error"
  };
}
