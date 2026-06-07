import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createServer as createViteServer } from "vite";
import { DUMBB_TEXT_TO_SPEACH, DUMB_SPEACH_TO_TEXT_transcription, RAW_AUDIO_TO_AI_TEXT_AND_AUDIO } from "./mod_ai_calls";
import { createAudioTurnDefaultPrompts } from "./lib_server_ai_voice";
import { VOICE_AGENT_BACKEND, type VoiceAgentServerAnalyseRequest, type VoiceAgentTextChatRequest } from "./voice_agent";
import type { Env } from "./server/bindings";
import { clearCostLedger, getCostLedger, listProviders, runCorrection } from "./server/app";
import { openLocalCostDb } from "./server/localDb";

loadLocalEnv();

const host = "0.0.0.0";
const port = 5173;

const vite = await createViteServer({
  server: {
    middlewareMode: true,
    hmr: false
  },
  appType: "spa"
});

const env: Env = {
  ASSETS: {
    fetch: async () => new Response("Assets are served by Vite in local Node dev.", { status: 404 })
  },
  COST_DB: openLocalCostDb()
};

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith("/api/")) {
    await handleApi(request, response);
    return;
  }

  vite.middlewares(request, response, (error: unknown) => {
    if (error) {
      if (error instanceof Error) {
        vite.ssrFixStacktrace(error);
      }
      response.statusCode = 500;
      response.end(error instanceof Error ? error.stack : String(error));
      return;
    }

    response.statusCode = 404;
    response.end("Not found");
  });
});

server.listen(port, host, () => {
  console.log(`Local Node app running at http://127.0.0.1:${port}`);
  for (const address of lanAddresses()) {
    console.log(`LAN access available at http://${address}:${port}`);
  }
});

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((items) => items || [])
    .filter((item) => item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function loadLocalEnv() {
  for (const fileName of [".env", ".env.local", "app/.env", "app/.env.local"]) {
    try {
      const text = readFileSync(fileName, "utf8");
      loadEnvText(text);
    } catch {
      // Local env files are optional.
    }
  }
}

function loadEnvText(text: string) {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      const name = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[name]) process.env[name] = value;
    }
}

async function handleApi(request: IncomingMessage, response: ServerResponse) {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);

    if (url.pathname === "/api/providers" && request.method === "GET") {
      sendJson(response, await listProviders());
      return;
    }

    if (url.pathname === "/api/costs" && request.method === "GET") {
      sendJson(response, await getCostLedger(env));
      return;
    }

    if (url.pathname === "/api/costs" && request.method === "DELETE") {
      sendJson(response, await clearCostLedger(env));
      return;
    }

    if (url.pathname === "/api/correct" && request.method === "POST") {
      sendJson(response, await runCorrection(await readJson(request), env));
      return;
    }

    if (url.pathname === "/api/transcribe" && request.method === "POST") {
      sendJson(response, await transcribeAudio(request));
      return;
    }

    if (url.pathname === "/api/speak" && request.method === "POST") {
      await speakAudio(request, response);
      return;
    }

    if (url.pathname === "/api/audio-turn" && request.method === "POST") {
      sendJson(response, await audioTurn(request));
      return;
    }

    if (url.pathname === "/api/audio-analyser" && request.method === "POST") {
      sendJson(response, await realMethod(request));
      return;
    }

    if (url.pathname === "/api/voice-agent/text-chat" && request.method === "POST") {
      sendJson(response, await voiceAgentTextChat(request));
      return;
    }

    sendJson(response, { error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, { error: message }, 500);
  }
}

async function voiceAgentTextChat(request: IncomingMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "VOICE_AGENT_TEXT_CHAT is not connected." };
  }

  const body = JSON.parse((await readBuffer(request)).toString("utf8")) as VoiceAgentTextChatRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);
  try {
    return await VOICE_AGENT_BACKEND.TEXT_CHAT(
      {
        provider: "openai",
        implementation: "openai-audio",
        openAiApiKey: apiKey,
        textModel: "gpt-4.1-mini",
        ttsModel: "gpt-4o-mini-tts",
        voice: settings.voice
      },
      body
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "VOICE_AGENT_TEXT_CHAT failed" };
  }
}

async function transcribeAudio(request: IncomingMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Audio transcription is not connected." };
  }

  const body = await readBuffer(request);
  const contentType = request.headers["content-type"];
  try {
    return await DUMB_SPEACH_TO_TEXT_transcription({ openAiApiKey: apiKey }, body, contentType);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "OpenAI transcription failed" };
  }
}

async function speakAudio(request: IncomingMessage, response: ServerResponse) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, { error: "AI voice is not connected." }, 503);
    return;
  }

  const body = JSON.parse((await readBuffer(request)).toString("utf8")) as {
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
    sendJson(response, { error: "AI voice text is empty." }, 400);
    return;
  }

  let result: { body: ReadableStream<Uint8Array> | null; contentType: string };
  try {
    result = await DUMBB_TEXT_TO_SPEACH(
      { openAiApiKey: apiKey },
      {
        text,
        voice: body.voice,
        languageName: body.languageName,
        style: [body.systemPrompt, body.additionalInstructions, body.style, body.history ? `HISTORY: ${JSON.stringify(body.history)}` : ""].filter(Boolean).join("\n") || undefined
      }
    );
  } catch (error) {
    sendJson(response, { error: error instanceof Error ? error.message : "OpenAI speech failed" }, 502);
    return;
  }

  const audio = Buffer.from(await new Response(result.body).arrayBuffer());
  response.statusCode = 200;
  response.setHeader("Content-Type", result.contentType);
  response.setHeader("Cache-Control", "no-store");
  response.end(audio);
}

async function audioTurn(request: IncomingMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Audio AI is not connected." };
  }

  const body = JSON.parse((await readBuffer(request)).toString("utf8")) as {
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
    return { error: "Audio AI input is empty." };
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
  try {
    return await RAW_AUDIO_TO_AI_TEXT_AND_AUDIO(
      { openAiApiKey: apiKey },
      {
        audioBase64,
        audioFormat: body.audioFormat,
        voice: body.voice,
        prompt
      }
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Audio AI failed" };
  }
}

async function realMethod(request: IncomingMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "AUDIO_ANALYSER is not connected." };
  }

  const body = JSON.parse((await readBuffer(request)).toString("utf8")) as VoiceAgentServerAnalyseRequest;
  const settings = VOICE_AGENT_BACKEND.CREATE_SERVER_SETTINGS(body);

  try {
    return await VOICE_AGENT_BACKEND.ANALYSE_AUDIO(
      {
        provider: "openai",
        implementation: "openai-audio",
        openAiApiKey: apiKey,
        audioModel: "gpt-audio",
        voice: settings.voice
      },
      {
        settings,
        audioBase64: String(body.audioBase64 || ""),
        audioFormat: body.audioFormat || "webm",
        textUserChat: body.textUserChat || "",
        history5LastTextChats: VOICE_AGENT_BACKEND.NORMALIZE_HISTORY(body.history5LastTextChats),
        additionalInstructions: body.additionalInstructions || ""
      }
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "AUDIO_ANALYSER failed" };
  }
}

function sendJson(response: ServerResponse, value: unknown, status = 200) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage) {
  return JSON.parse((await readBuffer(request)).toString("utf8"));
}

async function readBuffer(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
