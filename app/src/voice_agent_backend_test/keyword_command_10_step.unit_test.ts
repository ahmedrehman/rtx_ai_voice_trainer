import assert from "node:assert/strict";
import test from "node:test";
import {
  VOICE_AGENT_APPLY_KEYWORD_CONTROL_STATE,
  type VoiceAgentKeywordFlags,
  type VoiceAgentKeywordControlState
} from "../voice_agent";

test("VOICE_AGENT keyword command flow keeps computer/computer off as app control for 10 steps", () => {
  const state: VoiceAgentKeywordControlState = { speakEnabled: false };
  const steps: Array<{
    name: string;
    flags: VoiceAgentKeywordFlags;
    expectedSpeakEnabled: boolean;
    expectedAction: "speak_on" | "speak_off" | "none";
    expectedChanged: boolean;
  }> = [
    {
      name: "1. no command before conversation",
      flags: noKeyword(),
      expectedSpeakEnabled: false,
      expectedAction: "none",
      expectedChanged: false
    },
    {
      name: "2. AI heard computer",
      flags: keywordOn(),
      expectedSpeakEnabled: true,
      expectedAction: "speak_on",
      expectedChanged: true
    },
    {
      name: "3. normal correction after computer",
      flags: noKeyword(),
      expectedSpeakEnabled: true,
      expectedAction: "none",
      expectedChanged: false
    },
    {
      name: "4. AI heard computer off",
      flags: keywordOff(),
      expectedSpeakEnabled: false,
      expectedAction: "speak_off",
      expectedChanged: true
    },
    {
      name: "5. normal correction after computer off",
      flags: noKeyword(),
      expectedSpeakEnabled: false,
      expectedAction: "none",
      expectedChanged: false
    },
    {
      name: "6. AI heard computer again",
      flags: keywordOn(),
      expectedSpeakEnabled: true,
      expectedAction: "speak_on",
      expectedChanged: true
    },
    {
      name: "7. repeated computer while speak already on",
      flags: keywordOn(),
      expectedSpeakEnabled: true,
      expectedAction: "speak_on",
      expectedChanged: false
    },
    {
      name: "8. normal chat answer does not change speak",
      flags: noKeyword(),
      expectedSpeakEnabled: true,
      expectedAction: "none",
      expectedChanged: false
    },
    {
      name: "9. AI heard computer off again",
      flags: keywordOff(),
      expectedSpeakEnabled: false,
      expectedAction: "speak_off",
      expectedChanged: true
    },
    {
      name: "10. repeated computer off while speak already off",
      flags: keywordOff(),
      expectedSpeakEnabled: false,
      expectedAction: "speak_off",
      expectedChanged: false
    }
  ];

  for (const step of steps) {
    const decision = VOICE_AGENT_APPLY_KEYWORD_CONTROL_STATE(state, step.flags);
    state.speakEnabled = decision.speakEnabled;

    assert.equal(decision.speakEnabled, step.expectedSpeakEnabled, step.name);
    assert.equal(decision.action, step.expectedAction, step.name);
    assert.equal(decision.changed, step.expectedChanged, step.name);
  }
});

function keywordOn(): VoiceAgentKeywordFlags {
  return {
    keyword_on_sent: true,
    keyword_off_sent: false,
    keyword_detected: "on"
  };
}

function keywordOff(): VoiceAgentKeywordFlags {
  return {
    keyword_on_sent: false,
    keyword_off_sent: true,
    keyword_detected: "off"
  };
}

function noKeyword(): VoiceAgentKeywordFlags {
  return {
    keyword_on_sent: false,
    keyword_off_sent: false,
    keyword_detected: "none"
  };
}
