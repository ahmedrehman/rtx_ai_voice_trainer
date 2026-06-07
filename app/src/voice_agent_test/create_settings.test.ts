import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_CREATE_SETTINGS } from "../voice_agent";

test("VOICE_AGENT_CREATE_SETTINGS defaults to French for German", () => {
  const settings = VOICE_AGENT_CREATE_SETTINGS("french_for_german");
  assert.equal(settings.topicId, "french_for_german");
  assert.equal(settings.languageName, "French");
  assert.match(settings.topic, /French/i);
});
