import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { hasApiKey, sampleAudioBase64, serverConfig } from "./test_env";

test("VOICE_AGENT_STREAM_VOICE_TURN real OpenAI stream returns user-facing text and audio events", { timeout: 180000 }, async (t) => {
  if (!hasApiKey(t)) return;

  const response = await VOICE_AGENT_BACKEND.STREAM_VOICE_TURN(serverConfig(), {
    settings: VOICE_AGENT_DEFAULT_SETTINGS,
    audioBase64: sampleAudioBase64(),
    audioFormat: "wav",
    textUserChat: "",
    history5LastTextChats: []
  });
  const events = await readEvents(response);
  const done = events.find((event) => event.type === "done");
  const finalText = typeof done?.text === "string" ? done.text : "";

  assert.equal(response.status, 200);
  assert.ok(events.some((event) => event.type === "start"));
  assert.ok(events.some((event) => event.type === "provider_start"));
  assert.ok(done, JSON.stringify(events));
  assert.ok(finalText.trim().length > 0, JSON.stringify(done));
  assert.doesNotMatch(finalText, /provide.*audio|upload.*audio|need.*audio|hold on|will now analyze/i);
  assert.ok(
    events.some((event) => event.type === "audio_delta") || Boolean(done?.audio?.chunkCount && done.audio.chunkCount > 0),
    "expected audio_delta events or final audio"
  );
});

async function readEvents(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.startsWith("data:") ? part.slice(5).trim() : part)
    .map((jsonText) => JSON.parse(jsonText) as {
      type: string;
      text?: string;
      audio?: { chunkCount?: number };
    });
}
