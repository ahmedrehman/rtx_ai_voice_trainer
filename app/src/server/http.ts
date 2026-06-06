import type { Env } from "./bindings";
import { callOpenAiAudioTurn, callOpenAiSpeech, callOpenAiTranscription } from "../mod_ai_calls";
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

  return callOpenAiTranscription({ openAiApiKey: env.OPENAI_API_KEY }, formData);
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

  const result = await callOpenAiSpeech(
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
  };
  const audioBase64 = String(body.audioBase64 || "");
  if (!audioBase64) {
    return json({ error: "Audio AI input is empty." }, 400);
  }

  const settings = body.settings || {};
  const prompt = [
    `You are a silent-first ${settings.languageName || "French"} voice trainer.`,
    `Topic: ${settings.topic || "daily conversation"}.`,
    `Keyword: ${settings.keyword || "computer"}.`,
    "Listen to the user's audio.",
    "Return a short text message that is valid JSON with fields: text_original, text_corrected, message, hint, signal.",
    "Also produce a short spoken correction in audio. Keep it minimal."
  ].join("\n");
  return json(await callOpenAiAudioTurn(
    { openAiApiKey: env.OPENAI_API_KEY },
    {
      audioBase64,
      audioFormat: body.audioFormat,
      voice: body.voice,
      prompt
    }
  ));
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
