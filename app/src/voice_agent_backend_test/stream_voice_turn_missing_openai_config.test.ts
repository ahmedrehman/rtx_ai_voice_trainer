import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";

test("VOICE_AGENT_STREAM_VOICE_TURN returns stream error for missing OpenAI config", async () => {
  const response = await VOICE_AGENT_BACKEND.STREAM_VOICE_TURN(
    {
      provider: "openai",
      implementation: "openai-audio",
      openAiApiKey: "",
      audioModel: "gpt-audio",
      voice: "coral"
    },
    {
      settings: VOICE_AGENT_DEFAULT_SETTINGS,
      audioBase64: "abc",
      audioFormat: "wav",
      textUserChat: "",
      history5LastTextChats: []
    }
  );
  const events = await readEvents(response);
  const error = events.find((event) => event.type === "error");
  assert.equal(response.status, 200);
  assert.ok(error?.status?.error);
  assert.match(error.status.error, /OPENAI_API_KEY/);
});

async function readEvents(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.startsWith("data:") ? part.slice(5).trim() : part)
    .map((jsonText) => JSON.parse(jsonText) as { type: string; status?: { error?: string } });
}
