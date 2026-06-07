import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS } from "../voice_agent";
import { serverConfig } from "./test_env";

test("VOICE_AGENT_TEXT_CHAT returns standard error for missing typed text", async () => {
  const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    textUserChat: "",
    settings: VOICE_AGENT_DEFAULT_SETTINGS
  });

  assert.equal(result.status.method, "VOICE_AGENT_TEXT_CHAT");
  assert.equal(result.status.ok, false);
  assert.equal(result.status.phase, "error");
  assert.match(result.status.error || "", /requires textUserChat/i);
  assert.equal(result.json.chat_text_to_user, result.status.error);
});
