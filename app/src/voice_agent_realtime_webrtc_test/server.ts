export type RealtimeClientSecretInput = {
  openAiApiKey?: string;
  model?: string;
  voice?: string;
  instructions?: string;
};

export type RealtimeClientSecretOutput = {
  status: {
    method: "VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET";
    ok: boolean;
    phase: "done" | "error";
    startedAt: string;
    finishedAt: string;
    error?: string;
  };
  request: {
    endpoint: "POST /v1/realtime/client_secrets";
    model: string;
    voice: string;
    instructions: string;
  };
  response: unknown;
};

export async function VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET(input: RealtimeClientSecretInput): Promise<RealtimeClientSecretOutput> {
  const startedAt = new Date().toISOString();
  const model = input.model || "gpt-realtime";
  const voice = input.voice || "marin";
  const instructions = input.instructions || [
    "You are a realtime speech-to-speech proof for the voice trainer app.",
    "Keep responses very short.",
    "Do not speak unless the user is speaking to you during the active send-to-AI test.",
    "If you hear your own previous response through the microphone, ignore it and do not answer it.",
    "For French learner utterances, give only one short correction or confirmation."
  ].join("\n");
  const request = {
    endpoint: "POST /v1/realtime/client_secrets" as const,
    model,
    voice,
    instructions
  };

  try {
    if (!input.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${input.openAiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          instructions,
          audio: {
            output: { voice }
          }
        }
      })
    });
    const data = await response.json().catch(async () => ({ error: await response.text().catch(() => "Response was not JSON.") }));
    if (!response.ok) {
      throw new Error(typeof data === "object" && data && "error" in data ? JSON.stringify(data.error) : `OpenAI realtime client secret failed with ${response.status}`);
    }
    return {
      status: doneStatus(startedAt),
      request,
      response: data
    };
  } catch (error) {
    return {
      status: errorStatus(startedAt, error),
      request,
      response: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

function doneStatus(startedAt: string): RealtimeClientSecretOutput["status"] {
  return {
    method: "VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET",
    ok: true,
    phase: "done",
    startedAt,
    finishedAt: new Date().toISOString()
  };
}

function errorStatus(startedAt: string, error: unknown): RealtimeClientSecretOutput["status"] {
  return {
    method: "VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET",
    ok: false,
    phase: "error",
    startedAt,
    finishedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  };
}
