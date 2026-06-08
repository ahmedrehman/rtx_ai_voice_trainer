import {
  SYSTEM_AUDIO_TO_SPEAKER,
  SYSTEM_MEANINGFUL_AUDIO_CHUNK,
  type ClientVoiceConfig,
  type SystemMeaningfulAudioChunkInput,
  type SystemMeaningfulAudioChunkOutput
} from "../lib_client_voice_system";
import {
  AUDIO_ANALYSER,
  type AudioAnalyserOutput,
  type ServerAiConfig
} from "../lib_server_ai_voice";
import { createAudioAnalyserDefaultPrompts } from "../lib_server_ai_voice/audioAnalyserPrompts";
import { DUMBB_TEXT_TO_SPEACH, PURE_TEXT_TO_TEXT_CORRECTION, STREAM_AUDIO_TO_AI_TEXT_AND_AUDIO, STREAM_TEXT_CHAT_FAST } from "../mod_ai_calls";

export const VOICE_AGENT_SAMPLE_AUDIO_URL = "/test-audio/sample-voice-test.wav";
export const VOICE_AGENT_REQUEST_TIMEOUT_MS = 45000;

export type VoiceAgentSettings = {
  provider: "openai";
  voice: string;
  languageName: string;
  keywordOn: string;
  keywordOff: string;
  allowFreeChat: boolean;
  topicId: VoiceAgentTopicId;
  topic: string;
  prompts?: VoiceAgentPromptConfig;
};

export type VoiceAgentTopicId = "french_for_german" | "history" | "custom";

export type VoiceAgentPromptConfig = {
  systemPrompt: string;
  task: string;
  howToRespond: string;
  responseJsonFormat: string;
};

export type VoiceAgentTopicPreset = {
  id: VoiceAgentTopicId;
  label: string;
  languageName: string;
  topic: string;
};

export type VoiceAgentChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
};

export type VoiceAgentAnalyseInput = {
  endpoint?: string;
  settings: VoiceAgentSettings;
  audio: Blob;
  textUserChat: string;
  history5LastTextChats: string[];
  additionalInstructions?: string;
  speakEnabled?: boolean;
  requestTimeoutMs?: number;
};

export type VoiceAgentAnalyseResult = {
  status: {
    method: "VOICE_AGENT_ANALYSE_AUDIO";
    ok: boolean;
    phase: "done" | "error";
    startedAt: string;
    finishedAt: string;
    error?: string;
  };
  request: unknown;
  response: AudioAnalyserOutput | { error: string };
  chatMessage: VoiceAgentChatMessage | null;
  audio: {
    audioBase64: string;
    audioFormat: string;
  } | null;
};

export type VoiceAgentTextChatInput = {
  endpoint?: string;
  settings: VoiceAgentSettings;
  textUserChat: string;
  history5LastTextChats: string[];
  additionalInstructions?: string;
  speakEnabled?: boolean;
  requestTimeoutMs?: number;
};

export type VoiceAgentStreamTextChatInput = Omit<VoiceAgentTextChatInput, "speakEnabled"> & {
  onEvent?: (event: VoiceAgentStreamTextChatEvent) => void;
};

export type VoiceAgentStreamVoiceTurnInput = Omit<VoiceAgentAnalyseInput, "speakEnabled"> & {
  onEvent?: (event: VoiceAgentStreamVoiceTurnEvent) => void;
};

export type VoiceAgentKeywordFlags = {
  keyword_on_sent?: boolean;
  keyword_off_sent?: boolean;
  keyword_detected?: "on" | "off" | "none";
};

export type VoiceAgentKeywordControlState = {
  speakEnabled: boolean;
};

export type VoiceAgentKeywordControlDecision = {
  speakEnabled: boolean;
  changed: boolean;
  action: "speak_on" | "speak_off" | "none";
  reason: string;
};

export type VoiceAgentTextChatRequest = {
  textUserChat?: string;
  history5LastTextChats?: unknown[];
  provider?: string;
  voice?: string;
  speakEnabled?: boolean;
  systemPrompt?: string;
  additionalInstructions?: string;
  settings?: Partial<VoiceAgentSettings> & { keyword?: string };
  promptConfig?: {
    systemTask?: string;
    howToRespond?: string;
    responseJsonFormat?: string;
  };
};

export type VoiceAgentStreamTextChatEvent =
  | {
      type: "start";
      status: {
        method: "VOICE_AGENT_STREAM_TEXT_CHAT";
        ok: true;
        phase: "streaming";
        startedAt: string;
      };
      debug: {
        input: VoiceAgentTextChatRequest;
        promptSent: VoiceAgentStreamPrompt;
      };
    }
  | { type: "delta"; text: string }
  | {
      type: "done";
      status: {
        method: "VOICE_AGENT_STREAM_TEXT_CHAT";
        ok: true;
        phase: "done";
        startedAt: string;
        finishedAt: string;
      };
      text: string;
    }
  | {
      type: "error";
      status: {
        method: "VOICE_AGENT_STREAM_TEXT_CHAT";
        ok: false;
        phase: "error";
        startedAt: string;
        finishedAt: string;
        error: string;
      };
    };

export type VoiceAgentStreamPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

export type VoiceAgentStreamTextChatOutput = {
  status: {
    method: "VOICE_AGENT_STREAM_TEXT_CHAT";
    ok: boolean;
    phase: "done" | "error";
    startedAt: string;
    finishedAt: string;
    error?: string;
  };
  text: string;
  request: VoiceAgentTextChatRequest;
  events: VoiceAgentStreamTextChatEvent[];
};

export type VoiceAgentStreamVoiceTurnEvent =
  | {
      type: "start";
      status: {
        method: "VOICE_AGENT_STREAM_VOICE_TURN";
        ok: true;
        phase: "streaming";
        startedAt: string;
      };
      debug: {
        input: Omit<VoiceAgentServerAnalyseRequest, "audioBase64"> & { audioBase64: string };
        promptSent: {
          systemPrompt: string;
          taskPrompt: string;
          responseJsonFormat: string;
        };
        playbackNote: string;
      };
    }
  | { type: "provider_start"; model: string; providerRequest: unknown }
  | { type: "text_delta"; streamEventType: "append_delta"; text: string }
  | { type: "audio_transcript_delta"; streamEventType: "append_delta"; text: string }
  | { type: "audio_delta"; audioBase64: string; audioFormat: "pcm16"; byteLength: number }
  | {
      type: "done";
      status: {
        method: "VOICE_AGENT_STREAM_VOICE_TURN";
        ok: true;
        phase: "done";
        startedAt: string;
        finishedAt: string;
      };
      text: string;
      audio: { audioBase64: string; audioFormat: "wav"; chunkCount: number } | null;
    }
  | {
      type: "error";
      status: {
        method: "VOICE_AGENT_STREAM_VOICE_TURN";
        ok: false;
        phase: "error";
        startedAt: string;
        finishedAt: string;
        error: string;
      };
    };

export type VoiceAgentStreamVoiceTurnOutput = {
  status: {
    method: "VOICE_AGENT_STREAM_VOICE_TURN";
    ok: boolean;
    phase: "done" | "error";
    startedAt: string;
    finishedAt: string;
    error?: string;
  };
  text: string;
  audio: { audioBase64: string; audioFormat: "wav"; chunkCount: number } | null;
  request: Omit<VoiceAgentServerAnalyseRequest, "audioBase64"> & { audioBase64: string };
  events: VoiceAgentStreamVoiceTurnEvent[];
};

export type VoiceAgentTextChatOutput = {
  status: {
    method: "VOICE_AGENT_TEXT_CHAT";
    ok: boolean;
    phase: "done" | "error";
    startedAt: string;
    finishedAt: string;
    error?: string;
  };
  json: AudioAnalyserOutput["json"];
  audio: {
    audioBase64: string;
    audioFormat: string;
    model: string;
  } | null;
  debug: {
    input: Omit<VoiceAgentTextChatRequest, "settings"> & { settings: Partial<VoiceAgentSettings> };
    promptSent: {
      systemPrompt: string;
      taskPrompt: string;
      responseJsonFormat: string;
    };
    rawAiText: string;
    spokenAudioText?: string;
    spokenAudioError?: string;
  };
};

export type VoiceAgentServerAnalyseRequest = {
  audioBase64?: string;
  audioFormat?: string;
  textUserChat?: string;
  history5LastTextChats?: unknown[];
  provider?: string;
  voice?: string;
  systemPrompt?: string;
  additionalInstructions?: string;
  speakEnabled?: boolean;
  settings?: Partial<VoiceAgentSettings> & { keyword?: string };
  promptConfig?: {
    systemTask?: string;
    howToRespond?: string;
    responseJsonFormat?: string;
  };
};

export type VoiceAgentChunkResult = {
  chunk: SystemMeaningfulAudioChunkOutput;
  useful: boolean;
  reason: string;
};

export type VoiceAgentListenSendDecisionInput = {
  chunkUseful: boolean;
  isSpeaking: boolean;
  browserSpeechText?: string;
  lastAssistantText?: string;
  lastCorrectionText?: string;
};

export type VoiceAgentListenSendDecision = {
  sendToAi: boolean;
  reason: string;
  code: "send" | "chunk_not_useful" | "app_is_speaking" | "matches_last_assistant" | "matches_last_correction";
};

export const VOICE_AGENT_DEFAULT_SETTINGS: VoiceAgentSettings = {
  provider: "openai",
  voice: "coral",
  languageName: "French",
  keywordOn: "computer",
  keywordOff: "computer off",
  allowFreeChat: false,
  topicId: "french_for_german",
  topic: "French speaking practice for a German learner"
};

export const VOICE_AGENT_TOPIC_PRESETS: VoiceAgentTopicPreset[] = [
  {
    id: "french_for_german",
    label: "French for German",
    languageName: "French",
    topic: "French speaking practice for a German learner"
  },
  {
    id: "history",
    label: "History",
    languageName: "English",
    topic: "history learning conversation with short factual answers"
  },
  {
    id: "custom",
    label: "Custom",
    languageName: "French",
    topic: "custom conversation"
  }
];

export function VOICE_AGENT_CREATE_SETTINGS(topicId: VoiceAgentTopicId, current: VoiceAgentSettings = VOICE_AGENT_DEFAULT_SETTINGS): VoiceAgentSettings {
  const preset = VOICE_AGENT_TOPIC_PRESETS.find((topic) => topic.id === topicId) || VOICE_AGENT_TOPIC_PRESETS[0];
  return {
    ...current,
    topicId: preset.id,
    languageName: preset.languageName,
    topic: preset.topic,
    allowFreeChat: false,
    prompts: undefined
  };
}

export function VOICE_AGENT_CREATE_PROMPTS(settings: VoiceAgentSettings) {
  if (settings.prompts) return settings.prompts;
  const basePrompts = createAudioAnalyserDefaultPrompts({
    languageName: settings.languageName,
    topic: settings.topic,
    keywordOn: settings.keywordOn,
    keywordOff: settings.keywordOff,
    allowFreeChat: settings.allowFreeChat
  });
  if (settings.topicId === "history") {
    return {
      ...basePrompts,
      task: [
        basePrompts.task,
        "For this topic, answer history questions directly and briefly.",
        "If the user asks for facts, prefer a chat_answer over pronunciation correction unless speech clarity is the task."
      ].join("\n")
    };
  }
  if (settings.topicId === "french_for_german") {
    return {
      ...basePrompts,
      task: [
        basePrompts.task,
        settings.allowFreeChat
          ? "This topic is French learning, but free chat is enabled. Act as a normal helpful assistant for questions and requests."
          : "This topic is a French correction trainer for a German learner, not an open free-chat assistant.",
        "Focus on mistakes common for German speakers learning French when a correction is actually useful.",
        "For French practice utterances, check correction before casual chat.",
        "A question or request is not automatically a practice utterance.",
        settings.allowFreeChat
          ? "If the latest user message is a question or asks for information, answer the question directly. Do not translate unless the user asks for translation."
          : "If the latest user message is not a practice utterance, stay silent unless there is a correction to make.",
        "If the user made a concrete French mistake, return a correction result with has_corrections=true.",
        settings.allowFreeChat
          ? "If the French phrase is correct but the user asked a real question, answer the question instead of only confirming correctness."
          : "If the French phrase is correct, say it is correct briefly and give at most one useful hint.",
        settings.allowFreeChat
          ? "Free chat is enabled: answer normal user questions naturally. Only correct first when the message is clearly a language practice sentence."
          : "Free chat is disabled: do not start or continue open conversation. Only correct, confirm, or give one short hint for the latest practice input.",
        "Do not greet the user, ask if they are ready, or add unrelated small talk unless free chat is enabled and the latest user message asks for that.",
        "Do not mention pronunciation or accent unless giving a concrete correction."
      ].join("\n")
    };
  }
  return basePrompts;
}

export async function VOICE_AGENT_RECORD_CHUNK(config: ClientVoiceConfig, input: SystemMeaningfulAudioChunkInput): Promise<VoiceAgentChunkResult> {
  const chunk = await SYSTEM_MEANINGFUL_AUDIO_CHUNK(config, input);
  const useful = Boolean(chunk.status.ok && chunk.audio && chunk.audio.size > 0 && (chunk.browserSpeechText?.trim() || chunk.energyCheck.hasSound));
  return {
    chunk,
    useful,
    reason: useful
      ? "Useful chunk: audio exists and speech/text or audio energy was detected."
      : "Not useful: no confirmed speech/text or sound in this chunk."
  };
}

export function VOICE_AGENT_APPLY_KEYWORD_CONTROL_STATE(
  state: VoiceAgentKeywordControlState,
  flags: VoiceAgentKeywordFlags
): VoiceAgentKeywordControlDecision {
  if (flags.keyword_detected === "off" || flags.keyword_off_sent) {
    return {
      speakEnabled: false,
      changed: state.speakEnabled,
      action: "speak_off",
      reason: "AI detected the off control phrase. App must stop speaking."
    };
  }
  if (flags.keyword_detected === "on" || flags.keyword_on_sent) {
    return {
      speakEnabled: true,
      changed: !state.speakEnabled,
      action: "speak_on",
      reason: "AI detected the on control phrase. App may speak future correction audio."
    };
  }
  return {
    speakEnabled: state.speakEnabled,
    changed: false,
    action: "none",
    reason: "No control keyword flag was returned."
  };
}

export async function VOICE_AGENT_ANALYSE_AUDIO(input: VoiceAgentAnalyseInput): Promise<VoiceAgentAnalyseResult> {
  const startedAt = new Date().toISOString();
  const endpoint = input.endpoint || "/api/audio-analyser";
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  let request: ({ audioBase64: string } & Record<string, unknown>) | null = null;
  const timeout = startVoiceAgentRequestTimeout(endpoint, input.requestTimeoutMs);

  try {
    const aiAudio = await normalizeAudioBlobForOpenAi(input.audio);
    const audioBase64 = await blobToBase64(aiAudio.blob);
    request = {
      audioBase64,
      audioFormat: aiAudio.audioFormat,
      sourceAudio: {
        browserType: input.audio.type || "",
        browserSize: input.audio.size,
        convertedTo: aiAudio.audioFormat,
        conversion: aiAudio.conversion
      },
      textUserChat: input.textUserChat,
      history5LastTextChats: input.history5LastTextChats,
      speakEnabled: Boolean(input.speakEnabled),
      provider: input.settings.provider,
      voice: input.settings.voice,
      settings: {
        languageName: input.settings.languageName,
        topicId: input.settings.topicId,
        topic: input.settings.topic,
        keywordOn: input.settings.keywordOn,
        keywordOff: input.settings.keywordOff,
        allowFreeChat: input.settings.allowFreeChat,
        voice: input.settings.voice
      },
      systemPrompt: prompts.systemPrompt,
      additionalInstructions: input.additionalInstructions || "",
      promptConfig: {
        systemTask: prompts.task,
        howToRespond: prompts.howToRespond,
        responseJsonFormat: prompts.responseJsonFormat
      }
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({ error: "Response was not JSON." })) as AudioAnalyserOutput | { error: string };
    const methodOk = response.ok && isAudioAnalyserOutput(data) && data.status.ok;
    const error = isAudioAnalyserOutput(data) ? data.status.error : "error" in data ? data.error : undefined;
    const chatText = methodOk && isAudioAnalyserOutput(data) && VOICE_AGENT_SHOULD_SURFACE_CHAT(input.settings, data.json)
      ? data.json.chat_text_to_user || data.json.hint || data.status.error || ""
      : "";

    return {
      status: {
        method: "VOICE_AGENT_ANALYSE_AUDIO",
        ok: methodOk,
        phase: methodOk ? "done" : "error",
        startedAt,
        finishedAt: new Date().toISOString(),
        error: methodOk ? undefined : error || "AUDIO_ANALYSER failed"
      },
      request: withoutFullAudio(request),
      response: data,
      chatMessage: chatText ? { id: createId(), role: "assistant", text: chatText, createdAt: new Date().toISOString() } : null,
      audio: isAudioAnalyserOutput(data) && data.audio ? { audioBase64: data.audio.audioBase64, audioFormat: data.audio.audioFormat } : null
    };
  } catch (error) {
    const normalized = normalizeVoiceAgentRequestError(error, timeout);
    const errorMessage = normalized instanceof Error ? normalized.message : String(normalized);
    return {
      status: {
        method: "VOICE_AGENT_ANALYSE_AUDIO",
        ok: false,
        phase: "error",
        startedAt,
        finishedAt: new Date().toISOString(),
        error: errorMessage
      },
      request: request ? withoutFullAudio(request) : {
        sourceAudio: {
          browserType: input.audio.type || "",
          browserSize: input.audio.size
        }
      },
      response: { error: errorMessage },
      chatMessage: { id: createId(), role: "assistant", text: errorMessage, createdAt: new Date().toISOString() },
      audio: null
    };
  } finally {
    timeout.clear();
  }
}

export async function VOICE_AGENT_PLAY_AUDIO(config: ClientVoiceConfig, audio: { audioBase64: string; audioFormat: string }, options: { signal?: AbortSignal } = {}) {
  return SYSTEM_AUDIO_TO_SPEAKER(config, { audio: base64ToBlob(audio.audioBase64, audio.audioFormat), signal: options.signal });
}

export async function VOICE_AGENT_SEND_TEXT_CHAT(input: VoiceAgentTextChatInput) {
  const startedAt = new Date().toISOString();
  const endpoint = input.endpoint || "/api/voice-agent/text-chat";
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  const timeout = startVoiceAgentRequestTimeout(endpoint, input.requestTimeoutMs);
  const request: VoiceAgentTextChatRequest = {
    textUserChat: input.textUserChat,
    history5LastTextChats: input.history5LastTextChats,
    provider: input.settings.provider,
    voice: input.settings.voice,
    speakEnabled: Boolean(input.speakEnabled),
    settings: {
      languageName: input.settings.languageName,
      topicId: input.settings.topicId,
      topic: input.settings.topic,
      keywordOn: input.settings.keywordOn,
      keywordOff: input.settings.keywordOff,
      allowFreeChat: input.settings.allowFreeChat,
      voice: input.settings.voice
    },
    systemPrompt: prompts.systemPrompt,
    additionalInstructions: input.additionalInstructions || "",
    promptConfig: {
      systemTask: prompts.task,
      howToRespond: prompts.howToRespond,
      responseJsonFormat: prompts.responseJsonFormat
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({ error: "Response was not JSON." })) as VoiceAgentTextChatOutput | { error: string };
    const ok = response.ok && isVoiceAgentTextChatOutput(data) && data.status.ok;
    const error = isVoiceAgentTextChatOutput(data) ? data.status.error : "error" in data ? data.error : "VOICE_AGENT_TEXT_CHAT failed";
    const chatText = isVoiceAgentTextChatOutput(data) && VOICE_AGENT_SHOULD_SURFACE_CHAT(input.settings, data.json)
      ? data.json.chat_text_to_user || data.json.hint || ""
      : isVoiceAgentTextChatOutput(data) ? "" : error;
    return {
      status: {
        method: "VOICE_AGENT_TEXT_CHAT" as const,
        ok,
        phase: ok ? "done" as const : "error" as const,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: ok ? undefined : error
      },
      request,
      response: data,
      chatMessage: chatText ? { id: createId(), role: "assistant" as const, text: chatText, createdAt: new Date().toISOString() } : null,
      audio: isVoiceAgentTextChatOutput(data) && data.audio ? { audioBase64: data.audio.audioBase64, audioFormat: data.audio.audioFormat } : null
    };
  } catch (error) {
    const normalized = normalizeVoiceAgentRequestError(error, timeout);
    const message = normalized instanceof Error ? normalized.message : String(normalized);
    return {
      status: {
        method: "VOICE_AGENT_TEXT_CHAT" as const,
        ok: false,
        phase: "error" as const,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: message
      },
      request,
      response: { error: message },
      chatMessage: { id: createId(), role: "assistant" as const, text: message, createdAt: new Date().toISOString() },
      audio: null
    };
  } finally {
    timeout.clear();
  }
}

export async function VOICE_AGENT_STREAM_TEXT_CHAT(input: VoiceAgentStreamTextChatInput): Promise<VoiceAgentStreamTextChatOutput> {
  const startedAt = new Date().toISOString();
  const endpoint = input.endpoint || "/api/voice-agent/text-chat-stream";
  const timeout = startVoiceAgentRequestTimeout(endpoint, input.requestTimeoutMs);
  const request: VoiceAgentTextChatRequest = {
    textUserChat: input.textUserChat,
    history5LastTextChats: input.history5LastTextChats,
    provider: input.settings.provider,
    voice: input.settings.voice,
    speakEnabled: false,
    settings: {
      languageName: input.settings.languageName,
      topicId: input.settings.topicId,
      topic: input.settings.topic,
      keywordOn: input.settings.keywordOn,
      keywordOff: input.settings.keywordOff,
      allowFreeChat: input.settings.allowFreeChat,
      voice: input.settings.voice
    },
    additionalInstructions: input.additionalInstructions || ""
  };
  const events: VoiceAgentStreamTextChatEvent[] = [];
  let text = "";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify(request)
    });
    if (!response.ok || !response.body) {
      throw new Error(await response.text().catch(() => `VOICE_AGENT_STREAM_TEXT_CHAT failed with ${response.status}`));
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const parsed = consumeVoiceAgentSseEvents<VoiceAgentStreamTextChatEvent>(pending);
      pending = parsed.remaining;
      for (const event of parsed.events) {
        events.push(event);
        input.onEvent?.(event);
        if (event.type === "delta") text += event.text;
        if (event.type === "done") text = event.text;
        if (event.type === "error") throw new Error(event.status.error);
      }
    }

    for (const event of consumeVoiceAgentSseEvents<VoiceAgentStreamTextChatEvent>(pending).events) {
      events.push(event);
      input.onEvent?.(event);
      if (event.type === "delta") text += event.text;
      if (event.type === "done") text = event.text;
      if (event.type === "error") throw new Error(event.status.error);
    }

    return {
      status: doneStreamStatus(startedAt),
      text,
      request,
      events
    };
  } catch (error) {
    const normalized = normalizeVoiceAgentRequestError(error, timeout);
    const message = normalized instanceof Error ? normalized.message : String(normalized);
    const errorEvent: VoiceAgentStreamTextChatEvent = { type: "error", status: errorStreamStatus(startedAt, message) };
    if (!events.some((event) => event.type === "error")) {
      events.push(errorEvent);
      input.onEvent?.(errorEvent);
    }
    return {
      status: errorStreamStatus(startedAt, message),
      text,
      request,
      events
    };
  } finally {
    timeout.clear();
  }
}

export async function VOICE_AGENT_STREAM_VOICE_TURN(input: VoiceAgentStreamVoiceTurnInput): Promise<VoiceAgentStreamVoiceTurnOutput> {
  const startedAt = new Date().toISOString();
  const endpoint = input.endpoint || "/api/voice-agent/voice-turn-stream";
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  const timeout = startVoiceAgentRequestTimeout(endpoint, input.requestTimeoutMs);
  let request: VoiceAgentStreamVoiceTurnOutput["request"] | null = null;
  const events: VoiceAgentStreamVoiceTurnEvent[] = [];
  let text = "";
  let audio: VoiceAgentStreamVoiceTurnOutput["audio"] = null;

  try {
    const aiAudio = await normalizeAudioBlobForOpenAi(input.audio);
    const audioBase64 = await blobToBase64(aiAudio.blob);
    request = {
      audioBase64: `[base64 length=${audioBase64.length}]`,
      audioFormat: aiAudio.audioFormat,
      textUserChat: input.textUserChat,
      history5LastTextChats: input.history5LastTextChats,
      provider: input.settings.provider,
      voice: input.settings.voice,
      settings: {
        languageName: input.settings.languageName,
        topicId: input.settings.topicId,
        topic: input.settings.topic,
        keywordOn: input.settings.keywordOn,
        keywordOff: input.settings.keywordOff,
        allowFreeChat: input.settings.allowFreeChat,
        voice: input.settings.voice
      },
      systemPrompt: prompts.systemPrompt,
      additionalInstructions: input.additionalInstructions || "",
      promptConfig: {
        systemTask: prompts.task,
        howToRespond: prompts.howToRespond,
        responseJsonFormat: prompts.responseJsonFormat
      }
    };
    const wireRequest = { ...request, audioBase64 };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify(wireRequest)
    });
    if (!response.ok || !response.body) {
      throw new Error(await response.text().catch(() => `VOICE_AGENT_STREAM_VOICE_TURN failed with ${response.status}`));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const parsed = consumeVoiceAgentSseEvents<VoiceAgentStreamVoiceTurnEvent>(pending);
      pending = parsed.remaining;
      for (const event of parsed.events) {
        events.push(event);
        input.onEvent?.(event);
        if (event.type === "text_delta" || event.type === "audio_transcript_delta") text += event.text;
        if (event.type === "done") {
          text = event.text;
          audio = event.audio;
        }
        if (event.type === "error") throw new Error(event.status.error);
      }
    }

    for (const event of consumeVoiceAgentSseEvents<VoiceAgentStreamVoiceTurnEvent>(pending).events) {
      events.push(event);
      input.onEvent?.(event);
      if (event.type === "text_delta" || event.type === "audio_transcript_delta") text += event.text;
      if (event.type === "done") {
        text = event.text;
        audio = event.audio;
      }
      if (event.type === "error") throw new Error(event.status.error);
    }

    return {
      status: doneVoiceStreamStatus(startedAt),
      text,
      audio,
      request,
      events
    };
  } catch (error) {
    const normalized = normalizeVoiceAgentRequestError(error, timeout);
    const message = normalized instanceof Error ? normalized.message : String(normalized);
    const errorEvent: VoiceAgentStreamVoiceTurnEvent = { type: "error", status: errorVoiceStreamStatus(startedAt, message) };
    if (!events.some((event) => event.type === "error")) {
      events.push(errorEvent);
      input.onEvent?.(errorEvent);
    }
    return {
      status: errorVoiceStreamStatus(startedAt, message),
      text,
      audio,
      request: request || {
        audioBase64: "[not built]",
        audioFormat: input.audio.type || "",
        textUserChat: input.textUserChat,
        history5LastTextChats: input.history5LastTextChats
      },
      events
    };
  } finally {
    timeout.clear();
  }
}

export async function VOICE_AGENT_SERVER_ANALYSE_AUDIO(config: ServerAiConfig, input: {
  settings: VoiceAgentSettings;
  audioBase64: string;
  audioFormat?: string;
  textUserChat?: string;
  history5LastTextChats?: string[];
  additionalInstructions?: string;
  speakEnabled?: boolean;
}): Promise<AudioAnalyserOutput> {
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  const result = await AUDIO_ANALYSER(config, {
    provider: input.settings.provider,
    systemPrompt: {
      systemPrompt: prompts.systemPrompt,
      task: prompts.task,
      responseJsonFormat: prompts.responseJsonFormat,
      howToRespond: [input.additionalInstructions, prompts.howToRespond].filter(Boolean).join("\n")
    },
    textUserChat: input.textUserChat || "",
    audioUserAudio: {
      audioBase64: input.audioBase64,
      audioFormat: input.audioFormat || "wav"
    },
    history5LastTextChats: input.history5LastTextChats || [],
    voice: input.settings.voice,
    speakEnabled: Boolean(input.speakEnabled)
  });
  if (!result.status.ok || VOICE_AGENT_SHOULD_SURFACE_CHAT(input.settings, result.json)) return result;
  return {
    ...result,
    json: {
      ...result.json,
      chat_text_to_user: "",
      text_corrected: "",
      hint: ""
    },
    audio: null,
    debug: {
      ...result.debug,
      spokenAudioText: undefined,
      spokenAudioSource: undefined
    }
  };
}

export async function VOICE_AGENT_SERVER_STREAM_TEXT_CHAT(config: ServerAiConfig, body: VoiceAgentTextChatRequest): Promise<Response> {
  const startedAt = new Date().toISOString();
  const settings = VOICE_AGENT_CREATE_SERVER_SETTINGS(body);
  const promptSent = createStreamTextChatPrompt(settings, body);
  const requestForDebug: VoiceAgentTextChatRequest = {
    ...body,
    speakEnabled: false,
    settings: {
      languageName: settings.languageName,
      topicId: settings.topicId,
      topic: settings.topic,
      keywordOn: settings.keywordOn,
      keywordOff: settings.keywordOff,
      allowFreeChat: settings.allowFreeChat,
      voice: settings.voice
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let finalText = "";
      const send = (event: VoiceAgentStreamTextChatEvent) => controller.enqueue(encoder.encode(formatVoiceAgentSseEvent(event)));
      try {
        if (!body.textUserChat?.trim()) throw new Error("VOICE_AGENT_STREAM_TEXT_CHAT requires textUserChat.");
        if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
        send({
          type: "start",
          status: { method: "VOICE_AGENT_STREAM_TEXT_CHAT", ok: true, phase: "streaming", startedAt },
          debug: { input: requestForDebug, promptSent }
        });
        const textStream = await STREAM_TEXT_CHAT_FAST(
          { openAiApiKey: config.openAiApiKey },
          {
            model: config.textModel,
            systemPrompt: promptSent.systemPrompt,
            userPrompt: promptSent.userPrompt
          }
        );
        const reader = textStream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const delta = decoder.decode(value, { stream: true });
          if (!delta) continue;
          finalText += delta;
          send({ type: "delta", text: delta });
        }
        send({ type: "done", status: doneStreamStatus(startedAt), text: finalText });
      } catch (error) {
        send({
          type: "error",
          status: errorStreamStatus(startedAt, error instanceof Error ? error.message : String(error))
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function VOICE_AGENT_SERVER_STREAM_VOICE_TURN(config: ServerAiConfig, body: VoiceAgentServerAnalyseRequest): Promise<Response> {
  const startedAt = new Date().toISOString();
  const settings = VOICE_AGENT_CREATE_SERVER_SETTINGS(body);
  const systemPrompt = [
    "You are VOICE_AGENT_STREAM_VOICE_TURN, the fast user-facing voice turn method.",
    "You receive original user audio, optional text chat, topic settings, and recent history.",
    "The audio is already attached. Never ask the user to provide or upload audio.",
    "Return user-facing answer text and spoken audio through the stream.",
    "Do not return JSON, markdown, field names, flags, debug text, or internal analysis.",
    "Keep the answer short and natural.",
    "For practice utterances, correct or confirm the user's latest sentence.",
    "If there is a concrete mistake, give the corrected sentence and one short hint.",
    "If the sentence is correct, say it is correct and optionally give one tiny hint.",
    settings.allowFreeChat
      ? "Free chat is enabled: answer normal questions naturally, but still correct practice phrases first."
      : "Free chat is disabled: do not greet, start small talk, or continue open conversation. Only correct, confirm, or give one short hint.",
    body.additionalInstructions || ""
  ].filter(Boolean).join("\n");
  const taskPrompt = [
    `Target language: ${settings.languageName}.`,
    `Topic/context: ${settings.topic}.`,
    "CONTROL PHRASES - NOT LESSON CONTENT:",
    `ON control phrase: ${settings.keywordOn}.`,
    `OFF control phrase: ${settings.keywordOff}.`,
    "If a control phrase is heard, treat it as app mode control only. Do not translate it, answer about it, or make it part of the lesson response.",
    `TEXT USER CHAT: ${body.textUserChat || ""}`,
    `HISTORY 5 LAST TEXT CHATS: ${JSON.stringify(VOICE_AGENT_NORMALIZE_HISTORY(body.history5LastTextChats))}`,
    "Answer the current audio turn only.",
    "Use audio when it helps, but do not turn every answer into pronunciation analysis.",
    "This streaming method does not produce structured JSON flags. Use AUDIO_ANALYSER for structured correction flags."
  ].join("\n");
  const inputForDebug: Omit<VoiceAgentServerAnalyseRequest, "audioBase64"> & { audioBase64: string } = {
    ...body,
    audioBase64: `[base64 length=${String(body.audioBase64 || "").length}]`,
    settings: {
      languageName: settings.languageName,
      topicId: settings.topicId,
      topic: settings.topic,
      keywordOn: settings.keywordOn,
      keywordOff: settings.keywordOff,
      allowFreeChat: settings.allowFreeChat,
      voice: settings.voice
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const audioChunks: string[] = [];
      let finalText = "";
      const send = (event: VoiceAgentStreamVoiceTurnEvent) => controller.enqueue(encoder.encode(formatVoiceAgentSseEvent(event)));
      try {
        if (!body.audioBase64) throw new Error("VOICE_AGENT_STREAM_VOICE_TURN requires original audio.");
        if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is not configured.");
        send({
          type: "start",
          status: { method: "VOICE_AGENT_STREAM_VOICE_TURN", ok: true, phase: "streaming", startedAt },
          debug: {
            input: inputForDebug,
            promptSent: { systemPrompt, taskPrompt, responseJsonFormat: "none - streaming user-facing text/audio, not JSON" },
            playbackNote: "Audio chunks are real provider stream chunks. This debug page assembles them and plays the final audio after stream completion."
          }
        });
        const provider = await STREAM_AUDIO_TO_AI_TEXT_AND_AUDIO(
          { openAiApiKey: config.openAiApiKey },
          {
            model: config.audioModel,
            audioBase64: String(body.audioBase64),
            audioFormat: body.audioFormat || "wav",
            voice: settings.voice,
            prompt: [systemPrompt, "", "TASK INPUT:", taskPrompt].join("\n")
          }
        );
        send({ type: "provider_start", model: provider.model, providerRequest: provider.providerRequest });
        const reader = provider.stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.type === "text_delta") {
            finalText += value.text;
            send({ type: "text_delta", streamEventType: "append_delta", text: value.text });
          }
          if (value.type === "audio_transcript_delta") {
            finalText += value.text;
            send({ type: "audio_transcript_delta", streamEventType: "append_delta", text: value.text });
          }
          if (value.type === "audio_delta") {
            audioChunks.push(value.audioBase64);
            send({
              type: "audio_delta",
              audioBase64: value.audioBase64,
              audioFormat: value.audioFormat,
              byteLength: base64ByteLength(value.audioBase64)
            });
          }
        }
        send({
          type: "done",
          status: doneVoiceStreamStatus(startedAt),
          text: finalText.trim(),
          audio: audioChunks.length ? { audioBase64: pcm16ChunksToWavBase64(audioChunks, 24000), audioFormat: "wav", chunkCount: audioChunks.length } : null
        });
      } catch (error) {
        send({
          type: "error",
          status: errorVoiceStreamStatus(startedAt, error instanceof Error ? error.message : String(error))
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function VOICE_AGENT_SERVER_TEXT_CHAT(config: ServerAiConfig, body: VoiceAgentTextChatRequest): Promise<VoiceAgentTextChatOutput> {
  const startedAt = new Date().toISOString();
  const settings = VOICE_AGENT_CREATE_SERVER_SETTINGS(body);
  const prompts = VOICE_AGENT_CREATE_PROMPTS(settings);
  const systemPrompt = [
    "You are VOICE_AGENT_TEXT_CHAT, the typed-chat method for the voice trainer app.",
    "You receive typed user text, topic settings, and recent text-chat history.",
    "There is no microphone audio in this method.",
    "Do not judge pronunciation or accent in text-chat mode.",
    "Answer or correct only the latest textUserChat.",
    "Use history only as background context; never answer, correct, or summarize an older history item unless the latest textUserChat explicitly asks about it.",
    "Return exactly one JSON object. Do not wrap it in markdown.",
    "For corrections, chat_text_to_user must equal text_corrected exactly. No prefix, no explanation, no extra words.",
    "When free chat is disabled and there is no correction, chat_text_to_user must be an empty string."
  ].join("\n");
  const taskPrompt = [
    `Target language: ${settings.languageName}.`,
    `Topic/context: ${settings.topic}.`,
    "LATEST USER MESSAGE is the only message to answer.",
    "HISTORY 5 LAST TEXT CHATS is context only and must not become the answer target.",
    settings.allowFreeChat
      ? "Free chat is enabled: answer normal typed questions naturally. Do not translate unless the user asks for translation. Only correct first when the latest message is clearly a practice sentence."
      : "Free chat is disabled: do not continue open conversation. For typed input, correct, confirm, or give one short hint for the latest practice sentence.",
    "A question or request is not automatically a practice sentence.",
    "If free chat is enabled and the latest typed message is a question/request, answer it directly and set has_corrections false unless a correction is explicitly useful.",
    "If the typed message is a target-language practice sentence, check for correction before casual chat.",
    "If the typed message has a useful language mistake, set has_corrections true and return only the corrected sentence.",
    "If the typed practice sentence is already correct and free chat is disabled, set has_corrections false and return empty chat_text_to_user, empty text_corrected, and empty hint.",
    "In text-chat mode, correction_type may be grammar, vocabulary, meaning, or none. Do not use pronunciation/accent.",
    "Set is_chat_answer_or_correction to chat_answer for a normal answer, correction for correction feedback, or none only for unusable input.",
    "chat_text_to_user is the message displayed in the chat window.",
    "For corrections, chat_text_to_user must be the corrected sentence only.",
    body.additionalInstructions || "",
    prompts.howToRespond,
    "",
    "RESPONSE JSON FORMAT:",
    prompts.responseJsonFormat
  ].join("\n");
  const requestForDebug: VoiceAgentTextChatOutput["debug"]["input"] = {
    ...body,
    settings: {
      languageName: settings.languageName,
      topicId: settings.topicId,
      topic: settings.topic,
      keywordOn: settings.keywordOn,
      keywordOff: settings.keywordOff,
      allowFreeChat: settings.allowFreeChat,
      voice: settings.voice
    }
  };

  try {
    if (!body.textUserChat?.trim()) throw new Error("VOICE_AGENT_TEXT_CHAT requires textUserChat.");
    const ai = await PURE_TEXT_TO_TEXT_CORRECTION(
      { openAiApiKey: config.openAiApiKey },
      {
        model: config.textModel,
        systemPrompt,
        taskPrompt,
        userPayload: {
          textUserChat: body.textUserChat,
          history5LastTextChats: VOICE_AGENT_NORMALIZE_HISTORY(body.history5LastTextChats),
          topic: settings.topic,
          languageName: settings.languageName
        }
      }
    );
    const parsed = controlOnlyKeywordJson(applyTextKeywordFlags(parseVoiceAgentJson(ai.rawText), body.textUserChat || "", settings));
    const shouldSurfaceChat = VOICE_AGENT_SHOULD_SURFACE_CHAT(settings, parsed);
    const chatText = shouldSurfaceChat
      ? correctionOnlyChatText(parsed) || parsed.chat_text_to_user || parsed.hint || fallbackTextChatAnswer(body.textUserChat || "", settings)
      : "";
    const outputJson = { ...parsed, chat_text_to_user: chatText };
    const speechText = parsed.flags.has_corrections ? VOICE_AGENT_CORRECTION_TEXT(outputJson) : chatText;
    const shouldCreateAudio = Boolean(body.speakEnabled && shouldSurfaceChat && parsed.flags.has_corrections && speechText.trim());
    const audio = shouldCreateAudio
      ? await createTextChatSpeech(config, settings, speechText).catch((error) => ({
          audioBase64: "",
          audioFormat: "",
          model: "",
          error: error instanceof Error ? error.message : String(error)
        }))
      : null;
    return {
      status: doneTextStatus(startedAt),
      json: outputJson,
      audio: audio?.audioBase64 ? { audioBase64: audio.audioBase64, audioFormat: audio.audioFormat, model: audio.model } : null,
      debug: {
        input: requestForDebug,
        promptSent: {
          systemPrompt,
          taskPrompt,
          responseJsonFormat: prompts.responseJsonFormat
        },
        rawAiText: ai.rawText,
        spokenAudioText: shouldCreateAudio ? speechText : undefined,
        spokenAudioError: audio && "error" in audio ? String(audio.error) : undefined
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: errorTextStatus(startedAt, message),
      json: emptyVoiceAgentJson(message),
      audio: null,
      debug: {
        input: requestForDebug,
        promptSent: {
          systemPrompt,
          taskPrompt,
          responseJsonFormat: prompts.responseJsonFormat
        },
        rawAiText: ""
      }
    };
  }
}

export function VOICE_AGENT_CREATE_SERVER_SETTINGS(body: VoiceAgentServerAnalyseRequest): VoiceAgentSettings {
  const incoming = body.settings || {};
  const topicId = isTopicId(incoming.topicId) ? incoming.topicId : VOICE_AGENT_DEFAULT_SETTINGS.topicId;
  const base = VOICE_AGENT_CREATE_SETTINGS(topicId, VOICE_AGENT_DEFAULT_SETTINGS);
  const settings: VoiceAgentSettings = {
    ...base,
    provider: "openai",
    voice: body.voice || incoming.voice || base.voice,
    languageName: incoming.languageName || base.languageName,
    topic: incoming.topic || base.topic,
    keywordOn: incoming.keywordOn || incoming.keyword || base.keywordOn,
    keywordOff: incoming.keywordOff || base.keywordOff,
    allowFreeChat: typeof incoming.allowFreeChat === "boolean" ? incoming.allowFreeChat : base.allowFreeChat
  };
  const promptConfig = body.promptConfig || {};
  if (body.systemPrompt || promptConfig.systemTask || promptConfig.howToRespond || promptConfig.responseJsonFormat) {
    const defaults = VOICE_AGENT_CREATE_PROMPTS(settings);
    settings.prompts = {
      systemPrompt: body.systemPrompt || defaults.systemPrompt,
      task: promptConfig.systemTask || defaults.task,
      howToRespond: promptConfig.howToRespond || defaults.howToRespond,
      responseJsonFormat: promptConfig.responseJsonFormat || defaults.responseJsonFormat
    };
  }
  return settings;
}

export function VOICE_AGENT_NORMALIZE_HISTORY(value: unknown[] | undefined): string[] {
  return (value || []).slice(-5).map((item) => typeof item === "string" ? item : JSON.stringify(item));
}

export function VOICE_AGENT_DECIDE_LISTEN_SEND(input: VoiceAgentListenSendDecisionInput): VoiceAgentListenSendDecision {
  if (!input.chunkUseful) {
    return { sendToAi: false, code: "chunk_not_useful", reason: "NOT SENT. Chunk skipped because it was not useful." };
  }
  if (input.isSpeaking) {
    return { sendToAi: false, code: "app_is_speaking", reason: "NOT SENT. App is speaking, so microphone input may be speaker feedback." };
  }
  const heard = normalizeDecisionText(input.browserSpeechText || "");
  if (heard && heard === normalizeDecisionText(input.lastAssistantText || "")) {
    return { sendToAi: false, code: "matches_last_assistant", reason: "NOT SENT. Browser speech text matches the last assistant output." };
  }
  if (heard && heard === normalizeDecisionText(input.lastCorrectionText || "")) {
    return { sendToAi: false, code: "matches_last_correction", reason: "NOT SENT. Browser speech text matches the last correction output." };
  }
  return { sendToAi: true, code: "send", reason: "SENT. Chunk is useful and does not look like app speaker feedback." };
}

export function VOICE_AGENT_SHOULD_SURFACE_CHAT(settings: VoiceAgentSettings, json: AudioAnalyserOutput["json"]) {
  if (json.flags.keyword_detected !== "none" || json.flags.keyword_on_sent || json.flags.keyword_off_sent) return false;
  return Boolean(settings.allowFreeChat || json.flags.has_corrections);
}

export function VOICE_AGENT_CORRECTION_TEXT(json: AudioAnalyserOutput["json"]) {
  return json.text_corrected.trim() || json.chat_text_to_user.trim() || json.hint.trim();
}

function correctionOnlyChatText(json: AudioAnalyserOutput["json"]) {
  if (!json.flags.has_corrections) return "";
  return json.text_corrected.trim() || json.chat_text_to_user.trim();
}

function controlOnlyKeywordJson(json: AudioAnalyserOutput["json"]): AudioAnalyserOutput["json"] {
  if (json.flags.keyword_detected === "none") return json;
  return {
    flags: {
      ...json.flags,
      keyword_on_sent: json.flags.keyword_detected === "on",
      keyword_off_sent: json.flags.keyword_detected === "off",
      has_corrections: false,
      correction_type: "none",
      is_chat_answer_or_correction: "none"
    },
    chat_text_to_user: "",
    text_corrected: "",
    hint: ""
  };
}

function startVoiceAgentRequestTimeout(endpoint: string, requestTimeoutMs = VOICE_AGENT_REQUEST_TIMEOUT_MS) {
  let timedOut = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
    isTimedOut: () => timedOut,
    message: () => `VOICE_AGENT request timed out after ${requestTimeoutMs}ms: ${endpoint}`
  };
}

function normalizeVoiceAgentRequestError(error: unknown, timeout: ReturnType<typeof startVoiceAgentRequestTimeout>) {
  if (timeout.isTimedOut() || isAbortError(error)) return new Error(timeout.message());
  return error;
}

function isAbortError(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "name" in error &&
    String((error as { name?: unknown }).name) === "AbortError"
  );
}

export const VOICE_AGENT_FRONTEND = {
  RECORD_CHUNK: VOICE_AGENT_RECORD_CHUNK,
  DECIDE_LISTEN_SEND: VOICE_AGENT_DECIDE_LISTEN_SEND,
  ANALYSE_AUDIO: VOICE_AGENT_ANALYSE_AUDIO,
  SEND_TEXT_CHAT: VOICE_AGENT_SEND_TEXT_CHAT,
  STREAM_TEXT_CHAT: VOICE_AGENT_STREAM_TEXT_CHAT,
  STREAM_VOICE_TURN: VOICE_AGENT_STREAM_VOICE_TURN,
  PLAY_AUDIO: VOICE_AGENT_PLAY_AUDIO,
  SHOULD_SURFACE_CHAT: VOICE_AGENT_SHOULD_SURFACE_CHAT,
  CORRECTION_TEXT: VOICE_AGENT_CORRECTION_TEXT,
  APPLY_KEYWORD_CONTROL_STATE: VOICE_AGENT_APPLY_KEYWORD_CONTROL_STATE,
  CREATE_PROMPTS: VOICE_AGENT_CREATE_PROMPTS,
  CREATE_SETTINGS: VOICE_AGENT_CREATE_SETTINGS
};

export const VOICE_AGENT_BACKEND = {
  ANALYSE_AUDIO: VOICE_AGENT_SERVER_ANALYSE_AUDIO,
  TEXT_CHAT: VOICE_AGENT_SERVER_TEXT_CHAT,
  STREAM_TEXT_CHAT: VOICE_AGENT_SERVER_STREAM_TEXT_CHAT,
  STREAM_VOICE_TURN: VOICE_AGENT_SERVER_STREAM_VOICE_TURN,
  SHOULD_SURFACE_CHAT: VOICE_AGENT_SHOULD_SURFACE_CHAT,
  CORRECTION_TEXT: VOICE_AGENT_CORRECTION_TEXT,
  APPLY_KEYWORD_CONTROL_STATE: VOICE_AGENT_APPLY_KEYWORD_CONTROL_STATE,
  CREATE_PROMPTS: VOICE_AGENT_CREATE_PROMPTS,
  CREATE_SETTINGS: VOICE_AGENT_CREATE_SETTINGS,
  CREATE_SERVER_SETTINGS: VOICE_AGENT_CREATE_SERVER_SETTINGS,
  NORMALIZE_HISTORY: VOICE_AGENT_NORMALIZE_HISTORY
};

function isTopicId(value: unknown): value is VoiceAgentTopicId {
  return value === "french_for_german" || value === "history" || value === "custom";
}

function isAudioAnalyserOutput(value: unknown): value is AudioAnalyserOutput {
  return Boolean(value && typeof value === "object" && "status" in value && "json" in value);
}

function isVoiceAgentTextChatOutput(value: unknown): value is VoiceAgentTextChatOutput {
  return Boolean(value && typeof value === "object" && "status" in value && "json" in value && "debug" in value);
}

function parseVoiceAgentJson(text: string): AudioAnalyserOutput["json"] {
  try {
    const parsed = JSON.parse(extractJsonObjectText(text)) as Partial<AudioAnalyserOutput["json"]>;
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
    return emptyVoiceAgentJson(text);
  }
}

function extractJsonObjectText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function emptyVoiceAgentJson(message: string): AudioAnalyserOutput["json"] {
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

function fallbackTextChatAnswer(textUserChat: string, settings: VoiceAgentSettings) {
  const text = textUserChat.trim();
  if (!text) return "Please type a message.";
  if (settings.topicId === "french_for_german") {
    return settings.allowFreeChat
      ? `I can help with this French sentence: "${text}".`
      : `Phrase reçue : "${text}". Je dois la corriger ou confirmer.`;
  }
  if (settings.topicId === "history") {
    return `Let's discuss this history question: "${text}".`;
  }
  return `I can answer this: "${text}".`;
}

function applyTextKeywordFlags(json: AudioAnalyserOutput["json"], textUserChat: string, settings: VoiceAgentSettings): AudioAnalyserOutput["json"] {
  const detected = detectExactTextKeyword(textUserChat, settings);
  if (detected.keyword_detected === "none") return json;
  return {
    ...json,
    flags: {
      ...json.flags,
      keyword_on_sent: detected.keyword_detected === "on",
      keyword_off_sent: detected.keyword_detected === "off",
      keyword_detected: detected.keyword_detected,
      keyword_exact_text: detected.keyword_exact_text
    }
  };
}

function detectExactTextKeyword(textUserChat: string, settings: VoiceAgentSettings) {
  const text = normalizeKeywordText(textUserChat);
  const keywordOff = normalizeKeywordText(settings.keywordOff);
  const keywordOn = normalizeKeywordText(settings.keywordOn);
  if (keywordOff && text === keywordOff) {
    return { keyword_detected: "off" as const, keyword_exact_text: settings.keywordOff };
  }
  if (keywordOn && text === keywordOn) {
    return { keyword_detected: "on" as const, keyword_exact_text: settings.keywordOn };
  }
  return { keyword_detected: "none" as const, keyword_exact_text: "" };
}

function normalizeKeywordText(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeDecisionText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function createTextChatSpeech(config: ServerAiConfig, settings: VoiceAgentSettings, text: string) {
  const speech = await DUMBB_TEXT_TO_SPEACH(
    { openAiApiKey: config.openAiApiKey },
    {
      model: config.ttsModel,
      text,
      voice: settings.voice,
      languageName: settings.languageName,
      style: "Speak exactly the provided text. Do not add words like correction, correct, corrige, hint, explanation, JSON, field names, flags, or debug information."
    }
  );
  const buffer = await new Response(speech.body).arrayBuffer();
  return {
    audioBase64: arrayBufferToBase64(buffer),
    audioFormat: contentTypeToAudioFormat(speech.contentType),
    model: config.ttsModel || "gpt-4o-mini-tts"
  };
}

function doneTextStatus(startedAt: string): VoiceAgentTextChatOutput["status"] {
  return { method: "VOICE_AGENT_TEXT_CHAT", ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function errorTextStatus(startedAt: string, error: string): VoiceAgentTextChatOutput["status"] {
  return { method: "VOICE_AGENT_TEXT_CHAT", ok: false, phase: "error", startedAt, finishedAt: new Date().toISOString(), error };
}

function doneStreamStatus(startedAt: string) {
  return { method: "VOICE_AGENT_STREAM_TEXT_CHAT" as const, ok: true as const, phase: "done" as const, startedAt, finishedAt: new Date().toISOString() };
}

function errorStreamStatus(startedAt: string, error: string) {
  return { method: "VOICE_AGENT_STREAM_TEXT_CHAT" as const, ok: false as const, phase: "error" as const, startedAt, finishedAt: new Date().toISOString(), error };
}

function doneVoiceStreamStatus(startedAt: string) {
  return { method: "VOICE_AGENT_STREAM_VOICE_TURN" as const, ok: true as const, phase: "done" as const, startedAt, finishedAt: new Date().toISOString() };
}

function errorVoiceStreamStatus(startedAt: string, error: string) {
  return { method: "VOICE_AGENT_STREAM_VOICE_TURN" as const, ok: false as const, phase: "error" as const, startedAt, finishedAt: new Date().toISOString(), error };
}

function createStreamTextChatPrompt(settings: VoiceAgentSettings, body: VoiceAgentTextChatRequest): VoiceAgentStreamPrompt {
  return {
    systemPrompt: [
      "You are VOICE_AGENT_STREAM_TEXT_CHAT, the fast typed-chat streaming method for the voice trainer app.",
      "You receive typed user text, topic settings, and recent text-chat history.",
      "There is no microphone audio in this method.",
      "Answer only the latest textUserChat.",
      "Use history only as background context.",
      "Return plain user-facing answer text only.",
      "Do not return JSON, markdown, field names, flags, debug text, or audio instructions.",
      "Keep the answer short and natural."
    ].join("\n"),
    userPrompt: [
      `Target language: ${settings.languageName}.`,
      `Topic/context: ${settings.topic}.`,
      body.additionalInstructions || "",
      "Answer in plain text only.",
      "Do not use the JSON response format from other voice-agent methods.",
      "",
      "LATEST USER MESSAGE:",
      body.textUserChat || "",
      "",
      "HISTORY 5 LAST TEXT CHATS - context only:",
      JSON.stringify(VOICE_AGENT_NORMALIZE_HISTORY(body.history5LastTextChats))
    ].filter(Boolean).join("\n")
  };
}

function formatVoiceAgentSseEvent(event: VoiceAgentStreamTextChatEvent | VoiceAgentStreamVoiceTurnEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function consumeVoiceAgentSseEvents<T extends VoiceAgentStreamTextChatEvent | VoiceAgentStreamVoiceTurnEvent>(text: string) {
  const parts = text.split("\n\n");
  const remaining = parts.pop() || "";
  const events = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.startsWith("data:") ? part.slice(5).trim() : part)
    .map((jsonText) => {
      try {
        return JSON.parse(jsonText) as T;
      } catch {
        return null;
      }
    })
    .filter((event): event is T => Boolean(event));
  return { events, remaining };
}

function base64ByteLength(value: string) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

function concatBase64Chunks(chunks: string[]) {
  const byteArrays = chunks.map(base64ToUint8Array);
  const totalLength = byteArrays.reduce((sum, bytes) => sum + bytes.length, 0);
  const allBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const bytes of byteArrays) {
    allBytes.set(bytes, offset);
    offset += bytes.length;
  }
  return uint8ArrayToBase64(allBytes);
}

function pcm16ChunksToWavBase64(chunks: string[], sampleRate: number) {
  const pcmChunks = chunks.map(base64ToUint8Array);
  const dataLength = pcmChunks.reduce((sum, bytes) => sum + bytes.length, 0);
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  writeAsciiBytes(wav, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAsciiBytes(wav, 8, "WAVE");
  writeAsciiBytes(wav, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAsciiBytes(wav, 36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (const bytes of pcmChunks) {
    wav.set(bytes, offset);
    offset += bytes.length;
  }
  return uint8ArrayToBase64(wav);
}

function writeAsciiBytes(bytes: Uint8Array, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) bytes[offset + index] = text.charCodeAt(index);
}

function base64ToUint8Array(value: string) {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (value: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) return new Uint8Array(bufferCtor.from(value, "base64"));
  throw new Error("Base64 decoding is unavailable.");
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  if (typeof btoa === "function") return btoa(binary);
  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (bytes: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
  throw new Error("Base64 encoding is unavailable.");
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
  if (typeof btoa === "function") return btoa(binary);
  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (bytes: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString("base64");
  throw new Error("Base64 encoding is unavailable.");
}

function withoutFullAudio<T extends { audioBase64: string }>(request: T) {
  return { ...request, audioBase64: `[base64 length=${request.audioBase64.length}]` };
}

async function normalizeAudioBlobForOpenAi(blob: Blob): Promise<{ blob: Blob; audioFormat: "wav" | "mp3"; conversion: string }> {
  const type = blob.type.toLowerCase();
  if (type.includes("wav") || type.includes("wave")) {
    return { blob, audioFormat: "wav", conversion: "already_wav" };
  }
  if (type.includes("mpeg") || type.includes("mp3")) {
    return { blob, audioFormat: "mp3", conversion: "already_mp3" };
  }
  return {
    blob: await convertBrowserAudioBlobToWav(blob),
    audioFormat: "wav",
    conversion: `converted_from_${blob.type || "unknown"}_to_wav`
  };
}

async function convertBrowserAudioBlobToWav(blob: Blob): Promise<Blob> {
  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("Browser cannot convert microphone audio to WAV: AudioContext is unavailable.");
  }
  const context = new AudioContextConstructor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    return encodeAudioBufferAsWav(audioBuffer);
  } catch (error) {
    throw new Error(`Browser could not convert microphone audio (${blob.type || "unknown"}) to WAV: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}

function encodeAudioBufferAsWav(audioBuffer: AudioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const frameCount = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  offset = writeAscii(view, offset, "RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  offset = writeAscii(view, offset, "WAVE");
  offset = writeAscii(view, offset, "fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channelCount, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
  offset = writeAscii(view, offset, "data");
  view.setUint32(offset, dataSize, true); offset += 4;

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex][frameIndex]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
  return offset + text.length;
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function base64ToBlob(base64: string, format: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: format.startsWith("audio/") ? format : `audio/${format}` });
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
