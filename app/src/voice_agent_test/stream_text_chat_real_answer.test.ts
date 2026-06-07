import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, readVoiceAgentStreamEvents, serverConfig } from "./test_env";

test("VOICE_AGENT_STREAM_TEXT_CHAT real OpenAI stream returns answer text", { timeout: 120000 }, async (t) => {
  if (!hasApiKey(t)) return;
  const response = await VOICE_AGENT_BACKEND.STREAM_TEXT_CHAT(serverConfig(), {
    textUserChat: "Bonjour, reponds avec une phrase courte.",
    history5LastTextChats: ["assistant: French practice is ready."],
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });
  const events = await readVoiceAgentStreamEvents(response);
  const start = events.find((event) => event.type === "start");
  const deltas = events.filter((event) => event.type === "delta");
  const done = events.find((event) => event.type === "done");
  const text = deltas.map((event) => event.type === "delta" ? event.text : "").join("");

  assert.equal(response.status, 200);
  assert.ok(start);
  assert.ok(deltas.length > 0);
  assert.ok(done);
  assert.equal(done?.status.ok, true);
  assert.ok(text.trim().length > 0);
});
