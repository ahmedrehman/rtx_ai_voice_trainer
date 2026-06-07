import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { readVoiceAgentStreamEvents, serverConfig } from "./test_env";

test("VOICE_AGENT_STREAM_TEXT_CHAT returns stream error for missing OpenAI config", async () => {
  const response = await VOICE_AGENT_BACKEND.STREAM_TEXT_CHAT(
    { ...serverConfig(), openAiApiKey: "" },
    {
      textUserChat: "Bonjour",
      settings: VOICE_AGENT_DEFAULT_SETTINGS
    }
  );
  const events = await readVoiceAgentStreamEvents(response);
  const error = events.find((event) => event.type === "error");

  assert.equal(response.status, 200);
  assert.ok(error);
  assert.equal(error?.status.method, "VOICE_AGENT_STREAM_TEXT_CHAT");
  assert.equal(error?.status.ok, false);
  assert.match(error?.status.error || "", /OPENAI_API_KEY|configured|required/i);
});
