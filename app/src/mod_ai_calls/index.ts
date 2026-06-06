export type AiCallConfig = {
  openAiApiKey?: string;
};

export type AiCorrectionRequest = {
  model?: string;
  systemPrompt: string;
  taskPrompt: string;
  userPayload: unknown;
};

export type AiSpeechRequest = {
  text: string;
  voice?: string;
  languageName?: string;
  style?: string;
};

export type AiAudioTurnRequest = {
  audioBase64: string;
  audioFormat?: string;
  voice?: string;
  prompt: string;
};

export type AiAudioTurnResult = {
  model: string;
  text: string;
  audioBase64: string;
  audioFormat: "wav";
};

export async function callOpenAiCorrectionJson(config: AiCallConfig, request: AiCorrectionRequest) {
  const apiKey = requireOpenAiKey(config);
  const requestBody = {
    model: request.model || "gpt-4.1-mini",
    input: [
      { role: "system", content: request.systemPrompt },
      {
        role: "user",
        content: [
          "TASK:",
          request.taskPrompt,
          "",
          "DATA JSON:",
          JSON.stringify(request.userPayload)
        ].join("\n")
      }
    ],
    text: { format: { type: "json_object" } }
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(JSON.stringify({
      message: `OpenAI correction failed with ${response.status}`,
      requestBody,
      responseStatus: response.status,
      responseText: errorText
    }));
  }

  const data = await response.json();
  return {
    rawText: extractResponsesText(data),
    rawResponse: data,
    providerDebug: {
      endpoint: "POST /v1/responses",
      requestBody,
      responseStatus: response.status,
      responseJson: data
    }
  };
}

export async function callOpenAiTranscription(config: AiCallConfig, body: BodyInit, contentType?: string) {
  const apiKey = requireOpenAiKey(config);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      ...(contentType ? { "Content-Type": contentType } : {})
    },
    body
  });

  if (!response.ok) {
    throw new Error(await responseError(response, "OpenAI transcription failed"));
  }

  const data = await response.json() as { text?: string };
  return { text: data.text || "" };
}

export async function callOpenAiSpeech(config: AiCallConfig, request: AiSpeechRequest) {
  const apiKey = requireOpenAiKey(config);
  const text = request.text.trim();
  if (!text) throw new Error("AI voice text is empty.");

  const attempts = [
    { model: "gpt-4o-mini-tts", withInstructions: true },
    { model: "tts-1", withInstructions: false }
  ];
  let response: Response | null = null;
  let lastError = "";

  for (const attempt of attempts) {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: attempt.model,
        voice: request.voice || "coral",
        input: text,
        ...(attempt.withInstructions ? { instructions: request.style || `Speak as a calm ${request.languageName || "language"} teacher. Keep it short.` } : {}),
        response_format: "mp3"
      })
    });

    if (response.ok) break;
    lastError = await response.text().catch(() => "");
    response = null;
  }

  if (!response) {
    throw new Error(lastError || "OpenAI speech failed");
  }

  return {
    body: response.body,
    contentType: response.headers.get("Content-Type") || "audio/mpeg"
  };
}

export async function callOpenAiAudioTurn(config: AiCallConfig, request: AiAudioTurnRequest): Promise<AiAudioTurnResult> {
  const apiKey = requireOpenAiKey(config);
  if (!request.audioBase64) throw new Error("Audio AI input is empty.");

  const attempts = ["gpt-audio", "gpt-audio-1.5"];
  let lastError = "";

  for (const model of attempts) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { voice: request.voice || "coral", format: "wav" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: request.prompt },
              { type: "input_audio", input_audio: { data: request.audioBase64, format: request.audioFormat || "wav" } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      lastError = await response.text().catch(() => "");
      continue;
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string | null;
          audio?: { data?: string; transcript?: string };
        };
      }>;
    };
    const message = data.choices?.[0]?.message;
    return {
      model,
      text: message?.content || message?.audio?.transcript || "",
      audioBase64: message?.audio?.data || "",
      audioFormat: "wav"
    };
  }

  throw new Error(lastError || "Audio AI failed");
}

export function extractResponsesText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

function requireOpenAiKey(config: AiCallConfig) {
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return config.openAiApiKey;
}

async function responseError(response: Response, fallback: string) {
  const detail = await response.text().catch(() => "");
  return `${fallback} with ${response.status}${detail ? `: ${detail}` : ""}`;
}
