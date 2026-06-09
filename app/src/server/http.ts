import type { Env } from "./bindings";
import { DUMBB_TEXT_TO_SPEACH, RAW_AUDIO_TO_AI_TEXT_AND_AUDIO } from "../mod_ai_calls";
import { createAudioTurnDefaultPrompts } from "../lib_server_ai_voice";
import { VOICE_AGENT_BACKEND, type VoiceAgentServerAnalyseRequest, type VoiceAgentTextChatRequest } from "../voice_agent";
import { VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET, type RealtimeClientSecretInput } from "../voice_agent_realtime_webrtc_test/server";
import { clearCostLedger, getCostLedger, listProviders, runCorrection } from "./app";
import { json, methodNotAllowed, notFound } from "./responses";
import { transcribeOpenAiFormData } from "./transcriptionEndpoint";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const basePath = normalizeBasePath(env.APP_BASE_PATH);
  const pathname = stripBasePath(url.pathname, basePath);

  try {
    if (pathname === "/api/providers") {
      if (request.method !== "GET") return methodNotAllowed();
      return json(await listProviders());
    }

    if (pathname === "/api/costs") {
      if (request.method === "GET") return json(await getCostLedger(env));
      if (request.method === "DELETE") return json(await clearCostLedger(env));
      return methodNotAllowed();
    }

    if (pathname === "/api/correct") {
      if (request.method !== "POST") return methodNotAllowed();
      return json(await runCorrection(await request.json(), env));
    }

    if (pathname === "/api/transcribe") {
      if (request.method !== "POST") return methodNotAllowed();
      return json(await transcribeAudio(request, env));
    }

    if (pathname === "/api/speak") {
      if (request.method !== "POST") return methodNotAllowed();
      return speakAudio(request, env);
    }

    if (pathname === "/api/audio-turn") {
      if (request.method !== "POST") return methodNotAllowed();
      return audioTurn(request, env);
    }

    if (pathname === "/api/audio-analyser") {
      if (request.method !== "POST") return methodNotAllowed();
      return json(await realMethod(request, env));
    }

    if (pathname === "/api/voice-agent/text-chat") {
      if (request.method !== "POST") return methodNotAllowed();
      return json(await voiceAgentTextChat(request, env));
    }

    if (pathname === "/api/voice-agent/text-chat-stream") {
      if (request.method !== "POST") return methodNotAllowed();
      return voiceAgentTextChatStream(request, env);
    }

    if (pathname === "/api/voice-agent/realtime-client-secret") {
      if (request.method !== "POST") return methodNotAllowed();
      return voiceAgentRealtimeClientSecret(request, env);
    }

    if (pathname === "/api/voice-agent/voice-turn-stream") {
      if (request.method !== "POST") return methodNotAllowed();
      return voiceAgentVoiceTurnStream(request, env);
    }

    if (pathname.startsWith("/api/")) {
      return notFound();
    }

    return env.ASSETS.fetch(rewriteRequestPath(request, pathname));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 500);
  }
}

async function transcribeAudio(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return { error: "Audio transcription is not connected." };
  }

  const formData = await request.formData();
  return transcribeOpenAiFormData(env.OPENAI_API_KEY, formData);
}

async function speakAudio(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "AI voice is not connected." }, 503);
  }

  const body = await request.json() as {
    provider?: string;
    text?: string;
    voice?: string;
    languageName?: string;
    style?: string;
    systemPrompt?: string;
    additionalInstructions?: string;
    history?: unknown[];
  };
  const text = String(body.text || "").trim();
  if (!text) {
    return json({ error: "AI voice text is empty." }, 400);
  }

  const result = await DUMBB_TEXT_TO_SPEACH(
    { openAiApiKey: env.OPENAI_API_KEY },
    {
      text,
      voice: body.voice,
      languageName: body.languageName,
      style: [body.systemPrompt, body.additionalInstructions, body.style, body.history ? `HISTORY: ${JSON.stringify(body.history)}` : ""].filter(Boolean).join("\n") || undefined
    }
  );

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store"
    }
  });
}

async function audioTurn(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "Audio AI is not connected." }, 503);
  }

  const body = await request.json() as {
    audioBase64?: string;
    audioFormat?: string;
    provider?: string;
    voice?: string;
    systemPrompt?: string;
    additionalInstructions?: string;
    settings?: { languageName?: string; topic?: string; keyword?: string; keywordOn?: string; keywordOff?: string };
    promptConfig?: { systemTask?: string; howToRespond?: string; responseJsonFormat?: string };
  };
  const audioBase64 = String(body.audioBase64 || "");
  if (!audioBase64) {
    return json({ error: "Audio AI input is empty." }, 400);
  }

  const settings = body.settings || {};
  const promptConfig = body.promptConfig || {};
  const defaultPrompts = createAudioTurnDefaultPrompts(settings.languageName || "French");
  const prompt = [
    body.systemPrompt || defaultPrompts.systemPrompt,
    promptConfig.systemTask || defaultPrompts.taskPrompt,
    `Topic: ${settings.topic || "daily conversation"}.`,
    "Listen to the user's audio.",
    `RESPONSE JSON FORMAT: ${promptConfig.responseJsonFormat || defaultPrompts.responseJsonFormat}`,
    body.additionalInstructions,
    promptConfig.howToRespond || defaultPrompts.howToRespond
  ].filter(Boolean).join("\n");
  return json(await RAW_AUDIO_TO_AI_TEXT_AND_AUDIO(
    { openAiApiKey: env.OPENAI_API_KEY },
    {
      audioBase64,
      audioFormat: body.audioFormat,
      voice: body.voice,
      prompt
    }
  ));
}

async function voiceAgentTextChat(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return { error: "VOICE_AGENT_TEXT_CHAT is not connected." };
  }

  const body = await request.json() as VoiceAgentTextChatRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  return VOICE_AGENT_BACKEND.TEXT_CHAT(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      textModel: "gpt-4.1-mini",
      ttsModel: "gpt-4o-mini-tts",
      voice: settings.voice
    },
    body
  );
}

async function voiceAgentTextChatStream(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "VOICE_AGENT_STREAM_TEXT_CHAT is not connected." }, 503);
  }

  const body = await request.json() as VoiceAgentTextChatRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  return VOICE_AGENT_BACKEND.STREAM_TEXT_CHAT(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      textModel: "gpt-4.1-mini",
      voice: settings.voice
    },
    body
  );
}

async function voiceAgentVoiceTurnStream(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "VOICE_AGENT_STREAM_VOICE_TURN is not connected." }, 503);
  }

  const body = await request.json() as VoiceAgentServerAnalyseRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  return VOICE_AGENT_BACKEND.STREAM_VOICE_TURN(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      audioModel: "gpt-audio",
      voice: settings.voice
    },
    body
  );
}

async function voiceAgentRealtimeClientSecret(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "VOICE_AGENT_REALTIME_WEBRTC is not connected." }, 503);
  }

  const body = await request.json() as RealtimeClientSecretInput;
  const result = await VOICE_AGENT_REALTIME_CREATE_CLIENT_SECRET({
    ...body,
    openAiApiKey: env.OPENAI_API_KEY
  });
  return json(result.status.ok ? result.response : result, result.status.ok ? 200 : 500);
}

async function realMethod(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return { error: "AUDIO_ANALYSER is not connected." };
  }

  const body = await request.json() as VoiceAgentServerAnalyseRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  return VOICE_AGENT_BACKEND.ANALYSE_AUDIO(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      audioModel: "gpt-audio",
      voice: settings.voice
    },
    {
      settings,
      audioBase64: String(body.audioBase64 || ""),
      audioFormat: body.audioFormat || "webm",
      textUserChat: body.textUserChat || "",
      history5LastTextChats: VOICE_AGENT_BACKEND.NORMALIZE_HISTORY(body.history5LastTextChats),
      additionalInstructions: body.additionalInstructions || "",
      speakEnabled: Boolean(body.speakEnabled)
    }
  );
}

function normalizeBasePath(basePath = "/apps/aitutor/") {
  if (!basePath || basePath === "/") return "/";
  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function stripBasePath(pathname: string, basePath: string) {
  if (basePath === "/") return pathname;
  const baseWithoutTrailingSlash = basePath.slice(0, -1);
  if (pathname === baseWithoutTrailingSlash) return "/";
  if (!pathname.startsWith(basePath)) return pathname;
  return `/${pathname.slice(basePath.length)}`;
}

function rewriteRequestPath(request: Request, pathname: string) {
  const url = new URL(request.url);
  if (url.pathname === pathname) return request;
  url.pathname = pathname;
  return new Request(url.toString(), request);
}
