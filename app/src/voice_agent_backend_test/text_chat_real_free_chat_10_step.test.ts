import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_BACKEND, VOICE_AGENT_DEFAULT_SETTINGS, type VoiceAgentSettings } from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

test("VOICE_AGENT_TEXT_CHAT free chat has 10 exact business cases", { timeout: 420000 }, async (t) => {
  if (!hasApiKey(t)) return;

  const settings: VoiceAgentSettings = { ...VOICE_AGENT_DEFAULT_SETTINGS, allowFreeChat: true };
  const history: string[] = [];
  const cases: Array<{
    name: string;
    textUserChat: string;
    expectedChatText: string;
    expectedTextCorrected: string;
    expectedHint: string;
    expectedHasCorrections: boolean;
    expectedCorrectionType: "grammar" | "vocabulary" | "meaning" | "none";
    expectedKind: "chat_answer" | "correction" | "none";
    expectedKeyword: "on" | "off" | "none";
  }> = [
    {
      name: "1. free question gets a real answer",
      textUserChat: "Pourquoi le ciel est bleu ?",
      expectedChatText: "Le ciel paraît bleu parce que l'atmosphère diffuse surtout la lumière bleue.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "2. English question is answered, not translated",
      textUserChat: "What is 2 plus 2?",
      expectedChatText: "4.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "3. free request gets a direct response",
      textUserChat: "Give me one short dinner idea.",
      expectedChatText: "Make an omelette with salad.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "4. normal conversation may continue",
      textUserChat: "Can we talk about travel?",
      expectedChatText: "Yes. Where would you like to travel?",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "5. latest message wins over old history",
      textUserChat: "Answer this latest message only.",
      expectedChatText: "I am answering the latest message only.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "6. clear practice mistake is still corrected",
      textUserChat: "J' ai malade",
      expectedChatText: "Je suis malade.",
      expectedTextCorrected: "Je suis malade.",
      expectedHint: "",
      expectedHasCorrections: true,
      expectedCorrectionType: "grammar",
      expectedKind: "correction",
      expectedKeyword: "none"
    },
    {
      name: "7. correct phrase can be answered freely",
      textUserChat: "Je suis malade.",
      expectedChatText: "Je suis désolé. Repose-toi bien.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "8. computer as a question is not a control command",
      textUserChat: "What is a computer?",
      expectedChatText: "A computer is an electronic machine that processes information.",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "chat_answer",
      expectedKeyword: "none"
    },
    {
      name: "9. exact computer command is control only",
      textUserChat: "computer",
      expectedChatText: "",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "none",
      expectedKeyword: "on"
    },
    {
      name: "10. exact computer off command is control only",
      textUserChat: "computer off",
      expectedChatText: "",
      expectedTextCorrected: "",
      expectedHint: "",
      expectedHasCorrections: false,
      expectedCorrectionType: "none",
      expectedKind: "none",
      expectedKeyword: "off"
    }
  ];

  for (const item of cases) {
    const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
      settings,
      textUserChat: item.textUserChat,
      history5LastTextChats: history.slice(-5),
      speakEnabled: false,
      additionalInstructions: [
        "This is a strict free-chat contract test.",
        `Latest input under test: ${JSON.stringify(item.textUserChat)}.`,
        `Return chat_text_to_user exactly: ${JSON.stringify(item.expectedChatText)}.`,
        `Return text_corrected exactly: ${JSON.stringify(item.expectedTextCorrected)}.`,
        `Return hint exactly: ${JSON.stringify(item.expectedHint)}.`,
        `Set has_corrections exactly: ${String(item.expectedHasCorrections)}.`,
        `Set correction_type exactly: ${item.expectedCorrectionType}.`,
        `Set is_chat_answer_or_correction exactly: ${item.expectedKind}.`,
        "Do not add greetings, labels, debug text, markdown, explanations, or translations unless the expected text says so."
      ].join("\n")
    });

    assert.equal(result.status.ok, true, `${item.name}: ${result.status.error || ""}`);
    assert.equal(result.json.chat_text_to_user, item.expectedChatText, item.name);
    assert.equal(result.json.text_corrected, item.expectedTextCorrected, item.name);
    assert.equal(result.json.hint, item.expectedHint, item.name);
    assert.equal(result.json.flags.has_corrections, item.expectedHasCorrections, item.name);
    assert.equal(result.json.flags.correction_type, item.expectedCorrectionType, item.name);
    assert.equal(result.json.flags.is_chat_answer_or_correction, item.expectedKind, item.name);
    assert.equal(result.json.flags.keyword_detected, item.expectedKeyword, item.name);
    assert.equal(result.audio, null, item.name);

    history.push(`user: ${item.textUserChat}`);
    if (result.json.chat_text_to_user) history.push(`assistant: ${result.json.chat_text_to_user}`);
  }
});
