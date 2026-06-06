import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { createServer as createViteServer } from "vite";
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
  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      ...(contentType ? { "Content-Type": contentType } : {})
    },
    body
  });

  if (!upstream.ok) {
    return { error: `OpenAI transcription failed with ${upstream.status}` };
  }

  const data = await upstream.json() as { text?: string };
  return { text: data.text || "" };
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

  const attempts = [
    { model: "gpt-4o-mini-tts", withInstructions: true },
    { model: "tts-1", withInstructions: false }
  ];
  let upstream: Response | null = null;
  let lastError = "";

  for (const attempt of attempts) {
    upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: attempt.model,
        voice: body.voice || "coral",
        input: text,
        ...(attempt.withInstructions ? { instructions: body.style || `Speak as a calm ${body.languageName || "language"} teacher. Keep it short.` } : {}),
        response_format: "mp3"
      })
    });

    if (upstream.ok) break;
    lastError = await upstream.text().catch(() => "");
    upstream = null;
  }

  if (!upstream) {
    sendJson(response, { error: lastError || "OpenAI speech failed" }, 502);
    return;
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  response.statusCode = 200;
  response.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
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
  };
  const audioBase64 = String(body.audioBase64 || "");
  if (!audioBase64) {
    return { error: "Audio AI input is empty." };
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
  const attempts = ["gpt-audio", "gpt-audio-1.5"];
  let lastError = "";

  for (const model of attempts) {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { voice: body.voice || "coral", format: "wav" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_audio", input_audio: { data: audioBase64, format: body.audioFormat || "wav" } }
            ]
          }
        ]
      })
    });

    if (!upstream.ok) {
      lastError = await upstream.text().catch(() => "");
      continue;
    }

    const data = await upstream.json() as {
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

  return { error: lastError || "Audio AI failed" };
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
