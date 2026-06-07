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

export const VOICE_AGENT_SAMPLE_AUDIO_URL = "/test-audio/sample-voice-test.wav";

export type VoiceAgentSettings = {
  provider: "openai";
  voice: string;
  languageName: string;
  keywordOn: string;
  keywordOff: string;
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

export type VoiceAgentServerAnalyseRequest = {
  audioBase64?: string;
  audioFormat?: string;
  textUserChat?: string;
  history5LastTextChats?: unknown[];
  provider?: string;
  voice?: string;
  systemPrompt?: string;
  additionalInstructions?: string;
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

export const VOICE_AGENT_DEFAULT_SETTINGS: VoiceAgentSettings = {
  provider: "openai",
  voice: "coral",
  languageName: "French",
  keywordOn: "computer",
  keywordOff: "computer off",
  topicId: "french_for_german",
  topic: "daily conversation"
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
    prompts: undefined
  };
}

export function VOICE_AGENT_CREATE_PROMPTS(settings: VoiceAgentSettings) {
  if (settings.prompts) return settings.prompts;
  const basePrompts = createAudioAnalyserDefaultPrompts({
    languageName: settings.languageName,
    topic: settings.topic,
    keywordOn: settings.keywordOn,
    keywordOff: settings.keywordOff
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
        "Focus on mistakes common for German speakers learning French.",
        "Prioritize pronunciation and accent hints when the audio is understandable."
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

export async function VOICE_AGENT_ANALYSE_AUDIO(input: VoiceAgentAnalyseInput): Promise<VoiceAgentAnalyseResult> {
  const startedAt = new Date().toISOString();
  const endpoint = input.endpoint || "/api/audio-analyser";
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  let request: ({ audioBase64: string } & Record<string, unknown>) | null = null;

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
      provider: input.settings.provider,
      voice: input.settings.voice,
      settings: {
        languageName: input.settings.languageName,
        topicId: input.settings.topicId,
        topic: input.settings.topic,
        keywordOn: input.settings.keywordOn,
        keywordOff: input.settings.keywordOff,
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
      body: JSON.stringify(request)
    });
    const data = await response.json().catch(() => ({ error: "Response was not JSON." })) as AudioAnalyserOutput | { error: string };
    const methodOk = response.ok && isAudioAnalyserOutput(data) && data.status.ok;
    const error = isAudioAnalyserOutput(data) ? data.status.error : "error" in data ? data.error : undefined;
    const chatText = isAudioAnalyserOutput(data)
      ? data.json.chat_text_to_user || data.json.hint || data.status.error || ""
      : data.error;

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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
  }
}

export async function VOICE_AGENT_PLAY_AUDIO(config: ClientVoiceConfig, audio: { audioBase64: string; audioFormat: string }) {
  return SYSTEM_AUDIO_TO_SPEAKER(config, { audio: base64ToBlob(audio.audioBase64, audio.audioFormat) });
}

export async function VOICE_AGENT_SERVER_ANALYSE_AUDIO(config: ServerAiConfig, input: {
  settings: VoiceAgentSettings;
  audioBase64: string;
  audioFormat?: string;
  textUserChat?: string;
  history5LastTextChats?: string[];
  additionalInstructions?: string;
}): Promise<AudioAnalyserOutput> {
  const prompts = VOICE_AGENT_CREATE_PROMPTS(input.settings);
  return AUDIO_ANALYSER(config, {
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
    voice: input.settings.voice
  });
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
    keywordOff: incoming.keywordOff || base.keywordOff
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

export const VOICE_AGENT_FRONTEND = {
  RECORD_CHUNK: VOICE_AGENT_RECORD_CHUNK,
  ANALYSE_AUDIO: VOICE_AGENT_ANALYSE_AUDIO,
  PLAY_AUDIO: VOICE_AGENT_PLAY_AUDIO,
  CREATE_PROMPTS: VOICE_AGENT_CREATE_PROMPTS,
  CREATE_SETTINGS: VOICE_AGENT_CREATE_SETTINGS
};

export const VOICE_AGENT_BACKEND = {
  ANALYSE_AUDIO: VOICE_AGENT_SERVER_ANALYSE_AUDIO,
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
