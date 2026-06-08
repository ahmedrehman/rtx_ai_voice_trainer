import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_DECIDE_LISTEN_SEND } from "../voice_agent";

test("VOICE_AGENT_DECIDE_LISTEN_SEND blocks non-useful and speaker-feedback chunks before AI", () => {
  assert.deepEqual(
    VOICE_AGENT_DECIDE_LISTEN_SEND({ chunkUseful: false, isSpeaking: false }),
    { sendToAi: false, code: "chunk_not_useful", reason: "NOT SENT. Chunk skipped because it was not useful." }
  );

  assert.equal(
    VOICE_AGENT_DECIDE_LISTEN_SEND({ chunkUseful: true, isSpeaking: true }).code,
    "app_is_speaking"
  );

  assert.equal(
    VOICE_AGENT_DECIDE_LISTEN_SEND({
      chunkUseful: true,
      isSpeaking: false,
      browserSpeechText: "Je suis malade",
      lastAssistantText: "Je suis malade"
    }).code,
    "matches_last_assistant"
  );

  assert.equal(
    VOICE_AGENT_DECIDE_LISTEN_SEND({
      chunkUseful: true,
      isSpeaking: false,
      browserSpeechText: "Il y a quelque chose qui ne va pas.",
      lastCorrectionText: "Il y a quelque chose qui ne va pas"
    }).code,
    "matches_last_correction"
  );

  assert.deepEqual(
    VOICE_AGENT_DECIDE_LISTEN_SEND({
      chunkUseful: true,
      isSpeaking: false,
      browserSpeechText: "Nouvelle phrase",
      lastCorrectionText: "Je suis malade"
    }),
    { sendToAi: true, code: "send", reason: "SENT. Chunk is useful and does not look like app speaker feedback." }
  );
});
