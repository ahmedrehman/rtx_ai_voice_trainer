import { DUMBB_TEXT_TO_SPEACH, DUMB_SPEACH_TO_TEXT_transcription, RAW_AUDIO_TO_AI_TEXT_AND_AUDIO, RAW_AUDIO_TO_AI_TEXT_ONLY } from "../mod_ai_calls";
export { AUDIO_ANALYSER_DEFAULT_PROMPTS, createAudioAnalyserDefaultPrompts } from "./audioAnalyserPrompts";
export { AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS, createAudioTurnDefaultPrompts } from "./audioTurnPrompts";

export type ServerAiProvider = "openai";
export type ServerAiImplementation = "openai-audio" | "openai-transcribe" | "openai-tts";

export type MethodStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type ServerAiLogEvent = {
  level: "info" | "error";
  method: string;
  message: string;
  data?: unknown;
  createdAt: string;
};

export type ServerAiLogger = (event: ServerAiLogEvent) => void;

export type ServerAiConfig = {
  provider: ServerAiProvider;
  implementation: ServerAiImplementation;
  openAiApiKey?: string;
  textModel?: string;
  audioModel?: string;
  transcriptionModel?: string;
  ttsModel?: string;
  voice?: string;
  logger?: ServerAiLogger;
};

export type PrimitiveTextToAudioInput = {
  provider: ServerAiProvider;
  systemPrompt?: string;
  additionalInstructions?: string;
  text: string;
  history?: unknown[];
};

export type PrimitiveTextToAudioOutput = {
  status: MethodStatus;
  audio: ReadableStream<Uint8Array> | null;
  contentType: string;
  json: {
    analysis?: unknown;
    flags: Record<string, unknown>;
  };
  debug: {
    config: PublicServerAiConfig;
    input: PrimitiveTextToAudioInput;
    providerRequest: unknown;
  };
};

export type PrimitiveAudioToTextInput = {
  provider: ServerAiProvider;
  systemPrompt?: string;
  additionalInstructions?: string;
  textChat?: string;
  audioBody: BodyInit;
  audioContentType?: string;
  history?: unknown[];
};

export type PrimitiveAudioToTextOutput = {
  status: MethodStatus;
  audio: null;
  json: {
    text: string;
    hint: string;
    analysis?: unknown;
  };
  debug: {
    config: PublicServerAiConfig;
    inputWithoutAudioBody: Omit<PrimitiveAudioToTextInput, "audioBody">;
    providerRequest: unknown;
  };
};

export type AudioToAiTextAndAudioInput = {
  provider: ServerAiProvider;
  audioBase64: string;
  audioFormat?: string;
  systemPrompt: string;
  taskPrompt: string;
  responseJsonFormat: string;
  voice?: string;
};

export type AudioToAiTextAndAudioOutput = {
  status: MethodStatus;
  model: string;
  text: string;
  audioBase64: string;
  audioFormat: "wav";
  debug: {
    config: PublicServerAiConfig;
    inputWithoutAudio: Omit<AudioToAiTextAndAudioInput, "audioBase64"> & { audioBase64: string };
    promptSent: string;
  };
};

export type AudioAnalyserInput = {
  provider: ServerAiProvider;
  systemPrompt: {
    systemPrompt?: string;
    task: string;
    responseJsonFormat: string;
    howToRespond: string;
  };
  textUserChat?: string;
  audioUserAudio: {
    audioBase64: string;
    audioFormat?: string;
  };
  history5LastTextChats: unknown[];
  voice?: string;
  speakEnabled?: boolean;
};

export type AudioAnalyserOutput = {
  status: MethodStatus;
  json: {
    flags: {
      keyword_on_sent: boolean;
      keyword_off_sent: boolean;
      keyword_detected: "on" | "off" | "none";
      keyword_exact_text: string;
      has_corrections: boolean;
      correction_type: "pronunciation" | "accent" | "grammar" | "vocabulary" | "meaning" | "none";
      is_chat_answer_or_correction: "chat_answer" | "correction" | "none";
    };
    chat_text_to_user: string;
    text_corrected: string;
    hint: string;
  };
  audio: {
    audioBase64: string;
    audioFormat: string;
    model: string;
  } | null;
  debug: {
    config: PublicServerAiConfig;
    inputWithoutAudio: Omit<AudioAnalyserInput, "audioUserAudio"> & { audioUserAudio: { audioBase64: string; audioFormat?: string } };
    promptSent: {
      systemPrompt: string;
      taskPrompt: string;
      responseJsonFormat: string;
    };
    rawAiText: string;
    spokenAudioText?: string;
    spokenAudioSource?: string;
    spokenAudioError?: string;
  };
};

type PublicServerAiConfig = Omit<ServerAiConfig, "openAiApiKey" | "logger"> & { hasOpenAiApiKey: boolean };

export async function PRIMITIVE_TEXT_TO_AUDIO(config: ServerAiConfig, input: PrimitiveTextToAudioInput): Promise<PrimitiveTextToAudioOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "PRIMITIVE_TEXT_TO_AUDIO", "start", summarize(input));

  try {
    assertConfig(config, input.provider, "openai-tts");
    const providerRequest = {
      model: config.ttsModel || "gpt-4o-mini-tts",
      voice: inputProviderVoice(config),
      text: input.text,
      instructions: [input.systemPrompt, input.additionalInstructions].filter(Boolean).join("\n") || undefined,
      history: input.history || []
    };
    const result = await DUMBB_TEXT_TO_SPEACH(
      { openAiApiKey: config.openAiApiKey },
      {
        model: providerRequest.model,
        text: input.text,
        voice: providerRequest.voice,
        languageName: "language",
        style: providerRequest.instructions
      }
    );
    const output: PrimitiveTextToAudioOutput = {
      status: doneStatus("PRIMITIVE_TEXT_TO_AUDIO", startedAt),
      audio: result.body,
      contentType: result.contentType,
      json: { flags: {}, analysis: { usedPromptAsTtsInstructions: Boolean(providerRequest.instructions) } },
      debug: { config: publicConfig(config), input, providerRequest }
    };
    log(config, "info", "PRIMITIVE_TEXT_TO_AUDIO", "done", statusOnly(output.status));
    return output;
  } catch (error) {
    const status = errorStatus("PRIMITIVE_TEXT_TO_AUDIO", startedAt, error);
    log(config, "error", "PRIMITIVE_TEXT_TO_AUDIO", status.error || "error", summarize(input));
    return {
      status,
      audio: null,
      contentType: "",
      json: { flags: { error: true }, analysis: undefined },
      debug: { config: publicConfig(config), input, providerRequest: null }
    };
  }
}

export async function PRIMITIVE_AUDIO_TO_TEXT(config: ServerAiConfig, input: PrimitiveAudioToTextInput): Promise<PrimitiveAudioToTextOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "PRIMITIVE_AUDIO_TO_TEXT", "start", summarize(withoutAudioBody(input)));

  try {
    assertConfig(config, input.provider, "openai-transcribe");
    const audioBody = prepareTranscriptionBody(input.audioBody, config.transcriptionModel || "gpt-4o-mini-transcribe");
    const providerRequest = {
      model: config.transcriptionModel || "gpt-4o-mini-transcribe",
      contentType: input.audioContentType,
      promptNote: "systemPrompt/additionalInstructions/textChat/history are debug context; primitive transcription does not analyse pronunciation."
    };
    const result = await DUMB_SPEACH_TO_TEXT_transcription(
      { openAiApiKey: config.openAiApiKey },
      audioBody,
      input.audioContentType
    );
    const output: PrimitiveAudioToTextOutput = {
      status: doneStatus("PRIMITIVE_AUDIO_TO_TEXT", startedAt),
      audio: null,
      json: {
        text: result.text,
        hint: "DUMB transcription only. No pronunciation judgement.",
        analysis: { heardOriginalAudio: true, pronunciationJudgement: false }
      },
      debug: { config: publicConfig(config), inputWithoutAudioBody: withoutAudioBody(input), providerRequest }
    };
    log(config, "info", "PRIMITIVE_AUDIO_TO_TEXT", "done", statusOnly(output.status));
    return output;
  } catch (error) {
    const status = errorStatus("PRIMITIVE_AUDIO_TO_TEXT", startedAt, error);
    log(config, "error", "PRIMITIVE_AUDIO_TO_TEXT", status.error || "error", summarize(withoutAudioBody(input)));
    return {
      status,
      audio: null,
      json: { text: "", hint: status.error || "transcription failed", analysis: { error: true } },
      debug: { config: publicConfig(config), inputWithoutAudioBody: withoutAudioBody(input), providerRequest: null }
    };
  }
}

export async function AUDIO_TO_AI_TEXT_AND_AUDIO(config: ServerAiConfig, input: AudioToAiTextAndAudioInput): Promise<AudioToAiTextAndAudioOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "AUDIO_TO_AI_TEXT_AND_AUDIO", "start", summarize(withoutAudioBase64(input)));

  const promptSent = [
    input.systemPrompt,
    "",
    "TASK:",
    input.taskPrompt,
    "",
    "RESPONSE JSON FORMAT:",
    input.responseJsonFormat
  ].join("\n");

  try {
    assertConfig(config, input.provider, "openai-audio");
    const result = await RAW_AUDIO_TO_AI_TEXT_AND_AUDIO(
      { openAiApiKey: config.openAiApiKey },
      {
        model: config.audioModel || "gpt-audio",
        audioBase64: input.audioBase64,
        audioFormat: input.audioFormat,
        voice: input.voice || config.voice,
        prompt: promptSent
      }
    );
    const output: AudioToAiTextAndAudioOutput = {
      status: doneStatus("AUDIO_TO_AI_TEXT_AND_AUDIO", startedAt),
      ...result,
      debug: { config: publicConfig(config), inputWithoutAudio: withoutAudioBase64(input), promptSent }
    };
    log(config, "info", "AUDIO_TO_AI_TEXT_AND_AUDIO", "done", statusOnly(output.status));
    return output;
  } catch (error) {
    const status = errorStatus("AUDIO_TO_AI_TEXT_AND_AUDIO", startedAt, error);
    log(config, "error", "AUDIO_TO_AI_TEXT_AND_AUDIO", status.error || "error", summarize(withoutAudioBase64(input)));
    return {
      status,
      model: config.audioModel || "",
      text: "",
      audioBase64: "",
      audioFormat: "wav",
      debug: { config: publicConfig(config), inputWithoutAudio: withoutAudioBase64(input), promptSent }
    };
  }
}

export async function AUDIO_ANALYSER(config: ServerAiConfig, input: AudioAnalyserInput): Promise<AudioAnalyserOutput> {
  const startedAt = new Date().toISOString();
  log(config, "info", "AUDIO_ANALYSER", "start", summarize(withoutAnalyserAudio(input)));

  const systemPrompt = [
    input.systemPrompt.systemPrompt,
    input.systemPrompt.task,
    input.systemPrompt.howToRespond,
    "The original microphone audio is already attached to this request.",
    "For practice input, correct or confirm the latest user phrase. Answer freely only when the supplied business prompt allows free chat.",
    "Return the text message as JSON only.",
    "Do not put spoken-audio instructions inside the JSON.",
    "Never say you will analyze, process, proceed, wait, hold on, or need microphone audio.",
    "Do not write prose outside the JSON object."
  ].join("\n");
  const taskPrompt = [
    `TEXT USER CHAT: ${input.textUserChat || ""}`,
    `HISTORY 5 LAST TEXT CHATS: ${JSON.stringify(input.history5LastTextChats)}`,
    "Use the audio when it helps, but do not turn the answer into open small talk.",
    "The server will create spoken audio later only when json.flags.has_corrections is true."
  ].join("\n");

  try {
    assertConfig(config, input.provider, "openai-audio");
    if (!input.audioUserAudio.audioBase64) throw new Error("AUDIO_ANALYSER requires original microphone audio.");
    const ai = await RAW_AUDIO_TO_AI_TEXT_ONLY(
      { openAiApiKey: config.openAiApiKey },
      {
        model: config.audioModel,
        audioBase64: input.audioUserAudio.audioBase64,
        audioFormat: input.audioUserAudio.audioFormat,
        prompt: [
          systemPrompt,
          "",
          "TASK INPUT:",
          taskPrompt,
          "",
          "RESPONSE JSON FORMAT:",
          input.systemPrompt.responseJsonFormat
        ].join("\n")
      }
    );
    const parsed = parseAudioAnalyserJson(ai.text);
    const chatTextToUser = validateAudioAnalyserChatText(parsed.chat_text_to_user || parsed.hint, {
      requiresUserText: parsed.flags.has_corrections
    });
    const spokenAudioText = parsed.flags.has_corrections
      ? (parsed.text_corrected.trim() || chatTextToUser)
      : "";
    const spokenAudio = input.speakEnabled && parsed.flags.has_corrections && spokenAudioText
      ? await createAnalyserSpeechAudio(config, input, spokenAudioText).catch((error) => ({
          audioBase64: "",
          audioFormat: "",
          model: "",
          error: error instanceof Error ? error.message : String(error)
        }))
      : null;
    const output: AudioAnalyserOutput = {
      status: doneStatus("AUDIO_ANALYSER", startedAt),
      json: {
        flags: parsed.flags,
        chat_text_to_user: chatTextToUser,
        text_corrected: parsed.text_corrected,
        hint: parsed.hint
      },
      audio: spokenAudio?.audioBase64 ? { audioBase64: spokenAudio.audioBase64, audioFormat: spokenAudio.audioFormat, model: spokenAudio.model } : null,
      debug: {
        config: publicConfig(config),
        inputWithoutAudio: withoutAnalyserAudio(input),
        promptSent: { systemPrompt, taskPrompt, responseJsonFormat: input.systemPrompt.responseJsonFormat },
        rawAiText: ai.text,
        spokenAudioText: input.speakEnabled && parsed.flags.has_corrections ? spokenAudioText : undefined,
        spokenAudioSource: input.speakEnabled && parsed.flags.has_corrections ? "json.text_corrected" : undefined,
        spokenAudioError: spokenAudio && "error" in spokenAudio ? String(spokenAudio.error) : undefined
      }
    };
    log(config, "info", "AUDIO_ANALYSER", "done", statusOnly(output.status));
    return output;
  } catch (error) {
    const status = errorStatus("AUDIO_ANALYSER", startedAt, error);
    log(config, "error", "AUDIO_ANALYSER", status.error || "error", summarize(withoutAnalyserAudio(input)));
    return {
      status,
      json: emptyAnalyserJson(status.error || "AUDIO_ANALYSER failed"),
      audio: null,
      debug: {
        config: publicConfig(config),
        inputWithoutAudio: withoutAnalyserAudio(input),
        promptSent: { systemPrompt, taskPrompt, responseJsonFormat: input.systemPrompt.responseJsonFormat },
        rawAiText: ""
      }
    };
  }
}

async function createAnalyserSpeechAudio(config: ServerAiConfig, input: AudioAnalyserInput, text: string) {
  if (!text.trim()) return { audioBase64: "", audioFormat: "", model: "" };
  const speech = await DUMBB_TEXT_TO_SPEACH(
    { openAiApiKey: config.openAiApiKey },
    {
      model: config.ttsModel,
      text,
      voice: input.voice || config.voice,
      languageName: "",
      style: "Speak exactly the provided text. Do not add words like correction, correct, corrige, hint, explanation, JSON, braces, field names, flags, or debug information."
    }
  );
  const buffer = await new Response(speech.body).arrayBuffer();
  return {
    audioBase64: arrayBufferToBase64(buffer),
    audioFormat: contentTypeToAudioFormat(speech.contentType),
    model: config.ttsModel || "gpt-4o-mini-tts"
  };
}

function contentTypeToAudioFormat(contentType: string) {
  const value = contentType.toLowerCase();
  if (value.includes("wav")) return "wav";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("opus")) return "opus";
  if (value.includes("aac")) return "aac";
  return contentType || "audio/mpeg";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function assertConfig(config: ServerAiConfig, provider: ServerAiProvider, implementation: ServerAiImplementation) {
  if (config.provider !== provider) throw new Error(`provider mismatch: config=${config.provider}, input=${provider}`);
  if (config.provider !== "openai") throw new Error(`unsupported provider: ${config.provider}`);
  if (config.implementation !== implementation) throw new Error(`implementation mismatch: expected ${implementation}, got ${config.implementation}`);
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
}

function inputProviderVoice(config: ServerAiConfig, inputVoice?: string) {
  return inputVoice || config.voice || "coral";
}

function prepareTranscriptionBody(body: BodyInit, model: string) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    if (!body.has("model")) body.set("model", model);
  }
  return body;
}

function publicConfig(config: ServerAiConfig): PublicServerAiConfig {
  const { openAiApiKey, logger, ...rest } = config;
  void openAiApiKey;
  void logger;
  return { ...rest, hasOpenAiApiKey: Boolean(config.openAiApiKey) };
}

function doneStatus(method: string, startedAt: string): MethodStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorStatus(method: string, startedAt: string, error: unknown): MethodStatus {
  return { method, ok: false, phase: "error", startedAt, finishedAt: new Date().toISOString(), error: errorMessage(error) };
}

function statusOnly(status: MethodStatus) {
  return { ok: status.ok, phase: status.phase, error: status.error };
}

function log(config: ServerAiConfig, level: "info" | "error", method: string, message: string, data?: unknown) {
  config.logger?.({ level, method, message, data, createdAt: new Date().toISOString() });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function withoutAudioBody(input: PrimitiveAudioToTextInput) {
  const { audioBody, ...rest } = input;
  void audioBody;
  return rest;
}

function withoutAudioBase64(input: AudioToAiTextAndAudioInput): AudioToAiTextAndAudioOutput["debug"]["inputWithoutAudio"] {
  return { ...input, audioBase64: `[base64 length=${input.audioBase64.length}]` };
}

function withoutAnalyserAudio(input: AudioAnalyserInput): AudioAnalyserOutput["debug"]["inputWithoutAudio"] {
  return {
    ...input,
    audioUserAudio: {
      ...input.audioUserAudio,
      audioBase64: `[base64 length=${input.audioUserAudio.audioBase64.length}]`
    }
  };
}

function parseAudioAnalyserJson(text: string): AudioAnalyserOutput["json"] {
  try {
    const parsed = JSON.parse(text) as Partial<AudioAnalyserOutput["json"]>;
    return {
      flags: {
        keyword_on_sent: Boolean(parsed.flags?.keyword_on_sent),
        keyword_off_sent: Boolean(parsed.flags?.keyword_off_sent),
        keyword_detected: parsed.flags?.keyword_detected === "on" || parsed.flags?.keyword_detected === "off" ? parsed.flags.keyword_detected : "none",
        keyword_exact_text: String(parsed.flags?.keyword_exact_text || ""),
        has_corrections: Boolean(parsed.flags?.has_corrections),
        correction_type: parsed.flags?.correction_type === "pronunciation" ||
          parsed.flags?.correction_type === "accent" ||
          parsed.flags?.correction_type === "grammar" ||
          parsed.flags?.correction_type === "vocabulary" ||
          parsed.flags?.correction_type === "meaning"
          ? parsed.flags.correction_type
          : "none",
        is_chat_answer_or_correction: parsed.flags?.is_chat_answer_or_correction === "chat_answer" || parsed.flags?.is_chat_answer_or_correction === "correction"
          ? parsed.flags.is_chat_answer_or_correction
          : "none"
      },
      chat_text_to_user: String(parsed.chat_text_to_user || ""),
      text_corrected: String(parsed.text_corrected || ""),
      hint: String(parsed.hint || "")
    };
  } catch {
    return emptyAnalyserJson(text);
  }
}

function emptyAnalyserJson(message: string): AudioAnalyserOutput["json"] {
  return {
    flags: {
      keyword_on_sent: false,
      keyword_off_sent: false,
      keyword_detected: "none",
      keyword_exact_text: "",
      has_corrections: false,
      correction_type: "none",
      is_chat_answer_or_correction: "none"
    },
    chat_text_to_user: message,
    text_corrected: "",
    hint: ""
  };
}

export function validateAudioAnalyserChatText(text: string, options: { requiresUserText?: boolean } = {}) {
  const value = text.trim();
  if (!value && options.requiresUserText) {
    throw new Error("AUDIO_ANALYSER returned no user-facing chat_text_to_user.");
  }
  if (containsInternalProcessText(value)) {
    throw new Error("AUDIO_ANALYSER returned internal process text instead of a user-facing answer.");
  }
  return value;
}

function containsInternalProcessText(text: string) {
  return /(?:i will now|i[’']ll now|please hold|hold on|i need to listen to the audio|provide the original microphone audio|please provide.*audio|please upload|i[’']?m ready to analy[sz]e|i[’']?m unable to analy[sz]e audio directly|audio input is essential|once the audio is provided|proceed with the analysis|analy[sz]e pronunciation|process it and return|detect keywords and evaluate)/i.test(text);
}

function summarize(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (item instanceof FormData) return "[FormData]";
    if (item instanceof Blob) return `[Blob size=${item.size}]`;
    return item;
  }));
}
