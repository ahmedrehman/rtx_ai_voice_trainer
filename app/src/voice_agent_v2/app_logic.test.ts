import assert from "node:assert/strict";
import test from "node:test";
import { VOICE_AGENT_V2_DECIDE_APP_TURN } from "./app_logic";

test("free chat answers normal questions in chat, voice only when speak is on", () => {
  assertDecision({
    name: "listen off, speak off, freechat on",
    input: base({ listenOn: false, speakOn: false, freeChatOn: true, userText: "was ist 2+2", aiText: "4", audioAvailable: true }),
    expected: {
      status: "none",
      assistantText: "4",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: false,
      chatMessages: [{ role: "assistant", text: "4", audioLink: false }]
    }
  });

  assertDecision({
    name: "listen on, speak on, freechat on",
    input: base({ source: "voice", listenOn: true, speakOn: true, freeChatOn: true, userText: "was ist 2+2", aiText: "4", audioAvailable: true }),
    expected: {
      status: "none",
      assistantText: "4",
      shouldAutoPlayAudio: true,
      shouldKeepAudioLink: false,
      chatMessages: [
        { role: "user", text: "was ist 2+2", audioLink: false },
        { role: "assistant", text: "4", audioLink: false }
      ]
    }
  });

  assertDecision({
    name: "listen on, speak off, freechat on",
    input: base({ source: "voice", listenOn: true, speakOn: false, freeChatOn: true, userText: "was ist 2+2", aiText: "4", audioAvailable: true }),
    expected: {
      status: "none",
      assistantText: "4",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: false,
      chatMessages: [
        { role: "user", text: "was ist 2+2", audioLink: false },
        { role: "assistant", text: "4", audioLink: false }
      ]
    }
  });
});

test("typed correction mode writes app-formatted correction or OK without audio", () => {
  assertDecision({
    name: "typed question in correction mode is corrected, not answered",
    input: base({
      listenOn: false,
      speakOn: false,
      freeChatOn: false,
      userText: "Combien deux plus deux ?",
      aiText: "SignalRouge: Combien font deux plus deux ?",
      correctedText: "Combien font deux plus deux ?",
      correctionLevel: 3,
      audioAvailable: true
    }),
    expected: {
      status: "red",
      assistantText: "Correction: Combien font deux plus deux ?",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: false,
      chatMessages: [{ role: "assistant", text: "Correction: Combien font deux plus deux ?", audioLink: false }]
    }
  });

  assertDecision({
    name: "typed correct sentence in correction mode is green OK",
    input: base({
      listenOn: false,
      speakOn: false,
      freeChatOn: false,
      userText: "je suis malade",
      aiText: "SignalVert",
      correctedText: "je suis malade",
      correctionLevel: 0,
      audioAvailable: true
    }),
    expected: {
      status: "green",
      assistantText: "OK: je suis malade",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: false,
      chatMessages: [{ role: "assistant", text: "OK: je suis malade", audioLink: false }]
    }
  });

  assertDecision({
    name: "typed wrong sentence in correction mode is red correction",
    input: base({
      listenOn: false,
      speakOn: false,
      freeChatOn: false,
      userText: "je j'ai malade",
      aiText: "SignalRouge: je suis malade",
      correctedText: "je suis malade",
      correctionLevel: 3,
      audioAvailable: true
    }),
    expected: {
      status: "red",
      assistantText: "Correction: je suis malade",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: false,
      chatMessages: [{ role: "assistant", text: "Correction: je suis malade", audioLink: false }]
    }
  });
});

test("voice correction mode always writes user and assistant chat; level controls only voice", () => {
  assertDecision({
    name: "voice correct, speak off",
    input: base({ source: "voice", listenOn: true, speakOn: false, freeChatOn: false, userText: "je suis malade", aiText: "SignalVert", correctedText: "je suis malade", correctionLevel: 0, audioAvailable: true }),
    expected: greenVoiceExpected("je suis malade")
  });

  assertDecision({
    name: "voice correct, speak on",
    input: base({ source: "voice", listenOn: true, speakOn: true, freeChatOn: false, userText: "je suis malade", aiText: "SignalVert", correctedText: "je suis malade", correctionLevel: 0, audioAvailable: true }),
    expected: greenVoiceExpected("je suis malade")
  });

  assertDecision({
    name: "voice grammar correction, speak off",
    input: base({ source: "voice", listenOn: true, speakOn: false, freeChatOn: false, userText: "j'ai malade", aiText: "SignalRouge: je suis malade", correctedText: "je suis malade", correctionLevel: 3, audioAvailable: true }),
    expected: redVoiceExpected({ shouldAutoPlayAudio: false })
  });

  assertDecision({
    name: "voice grammar correction, speak on",
    input: base({ source: "voice", listenOn: true, speakOn: true, freeChatOn: false, userText: "j'ai malade", aiText: "SignalRouge: je suis malade", correctedText: "je suis malade", correctionLevel: 3, audioAvailable: true }),
    expected: redVoiceExpected({ shouldAutoPlayAudio: true })
  });
});

test("medium speak level skips yellow voice but keeps chat and audio link", () => {
  assertDecision({
    name: "yellow pronunciation below medium speak level",
    input: base({
      source: "voice",
      listenOn: true,
      speakOn: true,
      speakLevel: 2,
      freeChatOn: false,
      userText: "je suis malade",
      aiText: "SignalJaune: je suis malade",
      correctedText: "je suis malade",
      correctionLevel: 1,
      audioAvailable: true
    }),
    expected: {
      status: "yellow",
      assistantText: "OK: je suis malade",
      shouldAutoPlayAudio: false,
      shouldKeepAudioLink: true,
      chatMessages: [
        { role: "user", text: "je suis malade", audioLink: false },
        { role: "assistant", text: "OK: je suis malade", audioLink: true }
      ]
    }
  });

  assertDecision({
    name: "red correction passes medium speak level",
    input: base({
      source: "voice",
      listenOn: true,
      speakOn: true,
      speakLevel: 2,
      freeChatOn: false,
      userText: "j'ai malade",
      aiText: "SignalRouge: je suis malade",
      correctedText: "je suis malade",
      correctionLevel: 3,
      audioAvailable: true
    }),
    expected: redVoiceExpected({ shouldAutoPlayAudio: true })
  });
});

function base(patch: Partial<Parameters<typeof VOICE_AGENT_V2_DECIDE_APP_TURN>[0]> = {}): Parameters<typeof VOICE_AGENT_V2_DECIDE_APP_TURN>[0] {
  return {
    source: "text",
    listenOn: false,
    speakOn: false,
    freeChatOn: false,
    speakLevel: 1,
    userText: "",
    aiText: "",
    correctedText: "",
    correctionLevel: 0,
    audioAvailable: false,
    ...patch
  };
}

function greenVoiceExpected(userText: string) {
  return {
    status: "green",
    assistantText: `OK: ${userText}`,
    shouldAutoPlayAudio: false,
    shouldKeepAudioLink: false,
    chatMessages: [
      { role: "user", text: userText, audioLink: false },
      { role: "assistant", text: `OK: ${userText}`, audioLink: false }
    ]
  };
}

function redVoiceExpected(input: { shouldAutoPlayAudio: boolean }) {
  return {
    status: "red",
    assistantText: "Correction: je suis malade",
    shouldAutoPlayAudio: input.shouldAutoPlayAudio,
    shouldKeepAudioLink: true,
    chatMessages: [
      { role: "user", text: "j'ai malade", audioLink: false },
      { role: "assistant", text: "Correction: je suis malade", audioLink: true }
    ]
  };
}

function assertDecision(input: {
  name: string;
  input: Parameters<typeof VOICE_AGENT_V2_DECIDE_APP_TURN>[0];
  expected: {
    status: string;
    assistantText: string;
    shouldAutoPlayAudio: boolean;
    shouldKeepAudioLink: boolean;
    chatMessages: Array<{ role: string; text: string; audioLink: boolean }>;
  };
}) {
  const decision = VOICE_AGENT_V2_DECIDE_APP_TURN(input.input);
  assert.equal(decision.status, input.expected.status, input.name);
  assert.equal(decision.assistantText, input.expected.assistantText, input.name);
  assert.equal(decision.shouldAutoPlayAudio, input.expected.shouldAutoPlayAudio, input.name);
  assert.equal(decision.shouldKeepAudioLink, input.expected.shouldKeepAudioLink, input.name);
  assert.deepEqual(decision.chatMessages, input.expected.chatMessages, input.name);
}
