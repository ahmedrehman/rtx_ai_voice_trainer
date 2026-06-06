import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createServer as createViteServer } from "vite";
import { DUMBB_TEXT_TO_SPEACH, DUMB_SPEACH_TO_TEXT_transcription, RAW_AUDIO_TO_AI_TEXT_AND_AUDIO } from "./mod_ai_calls";
import { AUDIO_ANALYSER } from "./lib_server_ai_voice";
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
  try {
    const text = readFileSync(".env.local", "utf8");
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
  } catch {
    // Local env is optional.
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

    sendJson(response, { error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, { error: message }, 500);
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
    text?: string;
    voice?: string;
    languageName?: string;
    style?: string;
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
        style: body.style
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
    voice?: string;
    settings?: { languageName?: string; topic?: string; keyword?: string };
    promptConfig?: { systemTask?: string; howToRespond?: string; responseJsonFormat?: string };
  };
  const audioBase64 = String(body.audioBase64 || "");
  if (!audioBase64) {
    return { error: "Audio AI input is empty." };
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

  const body = JSON.parse((await readBuffer(request)).toString("utf8")) as {
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

  try {
    return await AUDIO_ANALYSER(
      {
        provider: "openai",
        implementation: "openai-audio",
        openAiApiKey: apiKey,
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
