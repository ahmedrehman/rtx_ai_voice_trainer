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
  const assertUserFacing = (text: string) => {
    assert.ok(text.trim().length > 0);
    assert.doesNotMatch(text, /need to listen to the audio|provide the original microphone audio|please upload|unable to analyze audio directly|hold on|will now analyze/i);
  };

  const turn1 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Bonjour.",
    history5LastTextChats: last5(),
    speakEnabled: false
  });
  assert.equal(turn1.status.ok, true, turn1.status.error);
  assert.equal(turn1.audio, null);
  assertUserFacing(turn1.json.chat_text_to_user);
  remember("user", "Bonjour.");
  remember("assistant", turn1.json.chat_text_to_user);

  const turn2 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Je suis aller au magasin hier.",
    history5LastTextChats: last5(),
    speakEnabled: true
  });
  assert.equal(turn2.status.ok, true, turn2.status.error);
  assert.ok(turn2.audio?.audioBase64, turn2.debug.spokenAudioError || "Speak on must return audio.");
  assert.equal(turn2.json.flags.has_corrections, true);
  assertUserFacing(turn2.json.chat_text_to_user);
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
  assert.equal(turn3.audio, null);
  assertUserFacing(turn3.json.chat_text_to_user);
  remember("assistant", turn3.json.chat_text_to_user);

  const turn4 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "computer off",
    history5LastTextChats: last5(),
    speakEnabled: false
  });
  assert.equal(turn4.status.ok, true, turn4.status.error);
  assert.equal(turn4.json.flags.keyword_off_sent, true);
  assert.equal(turn4.json.flags.keyword_detected, "off");
  assert.equal(turn4.audio, null);
  assertUserFacing(turn4.json.chat_text_to_user);
  remember("user", "computer off");
  remember("assistant", turn4.json.chat_text_to_user);

  const turn5 = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
    settings,
    textUserChat: "Comment ca va ?",
    history5LastTextChats: last5(),
    speakEnabled: false,
    additionalInstructions: "Answer only the latest user message. Do not discuss previous keyword commands."
  });
  assert.equal(turn5.status.ok, true, turn5.status.error);
  assert.equal(turn5.audio, null);
  assertUserFacing(turn5.json.chat_text_to_user);
  assert.doesNotMatch(turn5.json.chat_text_to_user.toLowerCase(), /computer off|keyword|mot.?cle/);
});
