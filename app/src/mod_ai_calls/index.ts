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
  model?: string;
  text: string;
  voice?: string;
  languageName?: string;
  style?: string;
};

export type AiAudioTurnRequest = {
  model?: string;
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

export type AiAudioTextResult = {
  model: string;
  text: string;
};

export type AiStreamTextRequest = {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
};

export async function PURE_TEXT_TO_TEXT_CORRECTION(config: AiCallConfig, request: AiCorrectionRequest) {
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
  let response: Response | null = null;
  let errorText = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    if (response.ok) break;
    errorText = await response.text().catch(() => "");
    if (!isTransientProviderStatus(response.status) || attempt === 2) break;
    await waitForRetry(attempt);
  }

  if (!response || !response.ok) {
    throw new Error(JSON.stringify({
      message: `OpenAI correction failed with ${response?.status || "no response"}`,
      requestBody,
      responseStatus: response?.status || 0,
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

export async function DUMB_SPEACH_TO_TEXT_transcription(config: AiCallConfig, body: BodyInit, contentType?: string) {
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

export async function DUMBB_TEXT_TO_SPEACH(config: AiCallConfig, request: AiSpeechRequest) {
  const apiKey = requireOpenAiKey(config);
  const text = request.text.trim();
  if (!text) throw new Error("AI voice text is empty.");

  const attempts = [
    { model: request.model || "gpt-4o-mini-tts", withInstructions: true },
    ...(request.model ? [] : [{ model: "tts-1", withInstructions: false }])
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

export async function RAW_AUDIO_TO_AI_TEXT_AND_AUDIO(config: AiCallConfig, request: AiAudioTurnRequest): Promise<AiAudioTurnResult> {
  const apiKey = requireOpenAiKey(config);
  if (!request.audioBase64) throw new Error("Audio AI input is empty.");
  const audioFormat = normalizeInputAudioFormat(request.audioFormat);

  const attempts = request.model ? [request.model] : ["gpt-audio", "gpt-audio-1.5"];
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
              { type: "input_audio", input_audio: { data: request.audioBase64, format: audioFormat } }
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

export async function RAW_AUDIO_TO_AI_TEXT_ONLY(config: AiCallConfig, request: AiAudioTurnRequest): Promise<AiAudioTextResult> {
  const apiKey = requireOpenAiKey(config);
  if (!request.audioBase64) throw new Error("Audio AI input is empty.");
  const audioFormat = normalizeInputAudioFormat(request.audioFormat);

  const attempts = request.model ? [request.model] : ["gpt-audio", "gpt-audio-1.5"];
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
        modalities: ["text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: request.prompt },
              { type: "input_audio", input_audio: { data: request.audioBase64, format: audioFormat } }
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
        };
      }>;
    };
    return {
      model,
      text: data.choices?.[0]?.message?.content || ""
    };
  }

  throw new Error(lastError || "Audio AI text failed");
}

export async function STREAM_TEXT_CHAT_FAST(config: AiCallConfig, request: AiStreamTextRequest): Promise<ReadableStream<Uint8Array>> {
  const apiKey = requireOpenAiKey(config);
  if (!request.userPrompt.trim()) throw new Error("STREAM_TEXT_CHAT_FAST requires userPrompt.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: request.model || "gpt-4.1-mini",
      stream: true,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt }
      ]
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(await responseError(response, "OpenAI stream text chat failed"));
  }

  return openAiSseToTextStream(response.body);
}

function openAiSseToTextStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = body.getReader();
  let pending = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const nextLine = readPendingLine();
        if (nextLine !== null) {
          const text = parseOpenAiStreamLine(nextLine);
          if (text === "[DONE]") {
            controller.close();
            return;
          }
          if (text) {
            controller.enqueue(encoder.encode(text));
            return;
          }
          continue;
        }

        const { done, value } = await reader.read();
        if (done) {
          const text = parseOpenAiStreamLine(pending);
          pending = "";
          if (text && text !== "[DONE]") controller.enqueue(encoder.encode(text));
          controller.close();
          return;
        }
        pending += decoder.decode(value, { stream: true });
      }
    },
    cancel() {
      return reader.cancel();
    }
  });

  function readPendingLine() {
    const newlineIndex = pending.indexOf("\n");
    if (newlineIndex < 0) return null;
    const line = pending.slice(0, newlineIndex).trim();
    pending = pending.slice(newlineIndex + 1);
    return line;
  }
}

function parseOpenAiStreamLine(line: string) {
  if (!line.startsWith("data:")) return "";
  const data = line.slice(5).trim();
  if (!data) return "";
  if (data === "[DONE]") return "[DONE]";
  try {
    const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content || "";
  } catch {
    return "";
  }
}

function normalizeInputAudioFormat(format?: string) {
  const value = (format || "wav").toLowerCase().trim();
  if (value === "wav" || value === "audio/wav" || value === "audio/x-wav") return "wav";
  if (value === "mp3" || value === "audio/mp3" || value === "audio/mpeg") return "mp3";
  throw new Error(`Unsupported OpenAI input audio format: ${format || ""}. Supported values are wav and mp3.`);
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

function isTransientProviderStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function waitForRetry(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
}
