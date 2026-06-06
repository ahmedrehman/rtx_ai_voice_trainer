import type { Env } from "./bindings";
import { DUMBB_TEXT_TO_SPEACH, DUMB_SPEACH_TO_TEXT_transcription, RAW_AUDIO_TO_AI_TEXT_AND_AUDIO } from "../mod_ai_calls";
import { AUDIO_ANALYSER } from "../lib_server_ai_voice";
import { clearCostLedger, getCostLedger, listProviders, runCorrection } from "./app";
import { json, methodNotAllowed, notFound } from "./responses";

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
  if (!formData.has("model")) {
    formData.set("model", "gpt-4o-mini-transcribe");
  }

  return DUMB_SPEACH_TO_TEXT_transcription({ openAiApiKey: env.OPENAI_API_KEY }, formData);
}

async function speakAudio(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "AI voice is not connected." }, 503);
  }

  const body = await request.json() as {
    text?: string;
    voice?: string;
    languageName?: string;
    style?: string;
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
      style: body.style
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
    voice?: string;
    settings?: { languageName?: string; topic?: string; keyword?: string };
    promptConfig?: { systemTask?: string; howToRespond?: string; responseJsonFormat?: string };
  };
  const audioBase64 = String(body.audioBase64 || "");
  if (!audioBase64) {
    return json({ error: "Audio AI input is empty." }, 400);
  }

  const settings = body.settings || {};
  const promptConfig = body.promptConfig || {};
  const prompt = [
    promptConfig.systemTask || `You are a silent-first ${settings.languageName || "French"} voice trainer.`,
    `Topic: ${settings.topic || "daily conversation"}.`,
    `Keyword: ${settings.keyword || "computer"}.`,
    "Listen to the user's audio.",
    promptConfig.responseJsonFormat ? `RESPONSE JSON FORMAT: ${promptConfig.responseJsonFormat}` : "Return a short text message that is valid JSON with fields: text_original, text_corrected, message, hint, signal.",
    promptConfig.howToRespond || "Also produce a short spoken correction in audio. Keep it minimal."
  ].join("\n");
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

async function realMethod(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) {
    return { error: "AUDIO_ANALYSER is not connected." };
  }

  const body = await request.json() as {
    audioBase64?: string;
    audioFormat?: string;
    textUserChat?: string;
    history5LastTextChats?: unknown[];
    settings?: { languageName?: string; topic?: string; keyword?: string };
    promptConfig?: { systemTask?: string; howToRespond?: string; responseJsonFormat?: string };
    voice?: string;
  };
  const settings = body.settings || {};
  const promptConfig = body.promptConfig || {};
  const responseJsonFormat = JSON.stringify({
    flags: {
      keyword_on_sent: "boolean",
      keyword_off_sent: "boolean",
      has_corrections: "boolean",
      is_chat_answer_or_correction: "chat_answer | correction | none"
    },
    chat_text_to_user: "short answer to user",
    text_corrected: "corrected user phrase",
    hint: "short pronunciation/accent hint"
  });

  return AUDIO_ANALYSER(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: env.OPENAI_API_KEY,
      audioModel: "gpt-audio",
      voice: body.voice || "coral"
    },
    {
      provider: "openai",
      systemPrompt: {
        task: promptConfig.systemTask || `You are a ${settings.languageName || "French"} voice trainer. Topic: ${settings.topic || "daily conversation"}. Keyword on/off words: ${settings.keyword || "computer"} / ${settings.keyword || "computer"} off.`,
        responseJsonFormat: promptConfig.responseJsonFormat || responseJsonFormat,
        howToRespond: promptConfig.howToRespond || "Use original audio. Return JSON text plus short spoken audio. Keep it short."
      },
      textUserChat: body.textUserChat || "",
      audioUserAudio: {
        audioBase64: String(body.audioBase64 || ""),
        audioFormat: body.audioFormat || "webm"
      },
      history5LastTextChats: body.history5LastTextChats || [],
      voice: body.voice || "coral"
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
