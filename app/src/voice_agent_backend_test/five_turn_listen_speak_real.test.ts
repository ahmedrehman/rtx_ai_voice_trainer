import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS, type VoiceAgentChatMessage } from "../voice_agent";
import { hasApiKey, sampleAudioBase64, serverConfig } from "./test_env";

test("VOICE_AGENT real five-turn conversation handles listen/speak changes without internal audio requests", { timeout: 420000 }, async (t) => {
  if (!hasApiKey(t)) return;

  const settings = VOICE_AGENT_DEFAULT_SETTINGS;
  const history: VoiceAgentChatMessage[] = [];
  const remember = (role: VoiceAgentChatMessage["role"], text: string) => {
    history.push({ id: String(history.length + 1), role, text, createdAt: new Date().toISOString() });
  };
  const last5 = () => history.slice(-5).map((message) => `${message.role}: ${message.text}`);
  const assertNoInternalText = (text: string) => {
    assert.doesNotMatch(text, /need to listen to the audio|provide the original microphone audio|please upload|unable to analyze audio directly|hold on|will now analyze/i);
  };
  const assertCorrectionVisibility = (turn: { json: { flags: { has_corrections: boolean }; chat_text_to_user: string }; audio: unknown }, speakEnabled: boolean) => {
    assertNoInternalText(turn.json.chat_text_to_user);
    if (turn.json.flags.has_corrections) {
      assert.ok(turn.json.chat_text_to_user.trim().length > 0);
      if (speakEnabled) assert.ok(turn.audio);
      if (!speakEnabled) assert.equal(turn.audio, null);
      return;
    }
    assert.equal(turn.json.chat_text_to_user, "");
    assert.equal(turn.audio, null);
  };

  const turn1 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Bonjour.",
    history5LastTextChats: last5(),
    speakEnabled: false
  });
  assert.equal(turn1.status.ok, true, turn1.status.error);
  assertCorrectionVisibility(turn1, false);
  remember("user", "Bonjour.");
  if (turn1.json.chat_text_to_user) remember("assistant", turn1.json.chat_text_to_user);

  const turn2 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Je suis aller au magasin hier.",
    history5LastTextChats: last5(),
    speakEnabled: true
  });
  assert.equal(turn2.status.ok, true, turn2.status.error);
  assert.equal(turn2.json.flags.has_corrections, true);
  assertCorrectionVisibility(turn2, true);
  remember("user", "Je suis aller au magasin hier.");
  remember("assistant", turn2.json.chat_text_to_user);

  const turn3 = await VOICE_AGENT_BACKEND.ANALYSE_AUDIO(serverConfig(), {
    settings,
    audioBase64: sampleAudioBase64(),
    audioFormat: "wav",
    textUserChat: "",
    history5LastTextChats: last5(),
    speakEnabled: false
  });
  assert.equal(turn3.status.ok, true, turn3.status.error);
  assertCorrectionVisibility(turn3, false);
  if (turn3.json.chat_text_to_user) remember("assistant", turn3.json.chat_text_to_user);

  const turn4 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "computer off",
    history5LastTextChats: last5(),
    speakEnabled: false
  });
  assert.equal(turn4.status.ok, true, turn4.status.error);
  assert.equal(turn4.json.flags.keyword_off_sent, true);
  assert.equal(turn4.json.flags.keyword_detected, "off");
  assertCorrectionVisibility(turn4, false);
  remember("user", "computer off");
  if (turn4.json.chat_text_to_user) remember("assistant", turn4.json.chat_text_to_user);

  const turn5 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Comment ca va ?",
    history5LastTextChats: last5(),
    speakEnabled: false,
    additionalInstructions: "Answer only the latest user message. Do not discuss previous keyword commands."
  });
  assert.equal(turn5.status.ok, true, turn5.status.error);
  assertCorrectionVisibility(turn5, false);
  assert.doesNotMatch(turn5.json.chat_text_to_user.toLowerCase(), /computer off|keyword|mot.?cle/);
});
