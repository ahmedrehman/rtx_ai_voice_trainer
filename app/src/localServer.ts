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

    sendJson(response, { error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, { error: message }, 500);
  }
}

async function transcribeAudio(request: IncomingMessage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "OPENAI_API_KEY is not configured locally." };
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
