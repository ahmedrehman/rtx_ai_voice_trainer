import assert from "node:assert/strict";
import test from "node:test";
import { DUMB_SPEACH_TO_TEXT_transcription, DUMBB_TEXT_TO_SPEACH } from "../mod_ai_calls";
import {
  VOICE_AGENT_BACKEND,
  VOICE_AGENT_CORRECTION_TEXT,
  VOICE_AGENT_DEFAULT_SETTINGS,
  VOICE_AGENT_SHOULD_SURFACE_CHAT,
  type VoiceAgentSettings
} from "../voice_agent";
import { hasApiKey, serverConfig } from "./test_env";

test("FULL APP correction flow checks input audio, listen/speak gates, chat visibility, lamp, and spoken correction", { timeout: 600000 }, async (t) => {
  if (!hasApiKey(t)) return;

  const settings: VoiceAgentSettings = { ...VOICE_AGENT_DEFAULT_SETTINGS, allowFreeChat: false };
  const app = createFullAppHarness(settings);
  const inputAudio = await createSpeechAudio("J'ai malade.");
  const inputTranscript = await transcribeAudio(inputAudio);

  assertInputAudioRepresentsBadPhrase(inputTranscript);

  app.sendAudioWhileListenOff(inputAudio);
  assert.equal(app.aiTextChatCalls, 0);
  assert.equal(app.aiAudioAnalyserCalls, 0);
  assert.equal(app.chatMessages.length, 0);
  assert.equal(app.lastAiAudioTranscript, "");
  assert.equal(app.lamp, "unchanged");

  const step1 = await app.sendChatText("J' ai malade", false, "Je suis malade");
  assertCorrectionStep(step1, "Je suis malade");
  assert.equal(app.lamp, "red");
  assert.equal(step1.audioTranscript, "");

  const step2 = await app.sendChatText("Je suis malade", false);
  assertNoCorrectionStep(step2);
  assert.equal(app.lamp, "green");
  assert.equal(step2.surfacedChatText, "");
  assert.equal(step2.audioTranscript, "");

  app.listenEnabled = true;
  const step3 = await app.sendChatText("J' ai malade", false, "Je suis malade");
  assertCorrectionStep(step3, "Je suis malade");
  assert.equal(app.lamp, "red");
  assert.equal(step3.audioTranscript, "");

  const step4 = await app.sendChatText("Il y a quelque chose qui ne pas.", false, "Il y a quelque chose qui ne va pas.");
  assertCorrectionStep(step4, "Il y a quelque chose qui ne va pas");
  assert.equal(app.lamp, "red");
  assert.equal(step4.audioTranscript, "");
  assert.equal(app.lastCorrectionText.includes("Il y a quelque chose qui ne va pas"), true);

  await app.turnSpeakOnWithoutNewInput();
  assert.equal(app.speakEnabled, true);
  assert.match(normalizeText(app.lastAiAudioTranscript), /il y a quelque chose qui ne va pas/);
  const speechCallsAfterStep5 = app.aiSpeechCalls;
  const textCallsAfterStep5 = app.aiTextChatCalls;

  app.noInputWhileSpeakAlreadyOn();
  assert.equal(app.aiTextChatCalls, textCallsAfterStep5);
  assert.equal(app.aiSpeechCalls, speechCallsAfterStep5);
  assert.match(normalizeText(app.lastAiAudioTranscript), /il y a quelque chose qui ne va pas/);

  const step7 = await app.sendChatText("J' ai malade", true, "Je suis malade");
  assertCorrectionStep(step7, "Je suis malade");
  assert.match(normalizeText(step7.audioTranscript), /je suis malade/);

  const step8 = await app.sendChatText("Je suis malade", true);
  assertNoCorrectionStep(step8);
  assert.equal(app.lamp, "green");
  assert.equal(step8.surfacedChatText, "");
  assert.equal(step8.audioTranscript, "");

  const step10 = await app.sendChatText("J' ai malade", true, "Je suis malade");
  assertCorrectionStep(step10, "Je suis malade");
  assert.match(normalizeText(step10.audioTranscript), /je suis malade/);
});

function createFullAppHarness(settings: VoiceAgentSettings) {
  return {
    settings,
    listenEnabled: false,
    speakEnabled: false,
    lamp: "unchanged" as "unchanged" | "red" | "green",
    chatMessages: [] as string[],
    lastCorrectionText: "",
    lastAiAudioTranscript: "",
    aiTextChatCalls: 0,
    aiAudioAnalyserCalls: 0,
    aiSpeechCalls: 0,
    sendAudioWhileListenOff(_audio: TestAudio) {
      if (!this.listenEnabled) return;
      this.aiAudioAnalyserCalls += 1;
    },
    async sendChatText(textUserChat: string, speakEnabled: boolean, expectedCorrection?: string) {
      this.speakEnabled = speakEnabled;
      this.aiTextChatCalls += 1;
      const result = await VOICE_AGENT_BACKEND.TEXT_CHAT(serverConfig(), {
        settings: this.settings,
        textUserChat,
        history5LastTextChats: this.chatMessages.slice(-5),
        speakEnabled,
        additionalInstructions: [
          "This is a full app business test.",
          "When the latest text is \"J' ai malade\", correct it to \"Je suis malade\" and set has_corrections true.",
          "When the latest text is \"Je suis malade\", set has_corrections false.",
          "When the latest text is \"Il y a quelque chose qui ne pas.\", correct it to \"Il y a quelque chose qui ne va pas.\" and set has_corrections true.",
          "Free chat is off: do not add greetings, readiness questions, or unrelated conversation."
        ].join("\n")
      });
      assert.equal(result.status.ok, true, result.status.error);
      const surfacedChatText = VOICE_AGENT_SHOULD_SURFACE_CHAT(this.settings, result.json)
        ? result.json.chat_text_to_user
        : "";
      if (surfacedChatText) this.chatMessages.push(surfacedChatText);
      if (result.json.flags.has_corrections) {
        this.lamp = "red";
        this.lastCorrectionText = VOICE_AGENT_CORRECTION_TEXT(result.json);
      } else {
        this.lamp = "green";
        this.lastCorrectionText = "";
      }
      let audioTranscript = "";
      if (result.audio?.audioBase64) {
        this.aiSpeechCalls += 1;
        audioTranscript = await transcribeAudio({
          bytes: Buffer.from(result.audio.audioBase64, "base64"),
          contentType: result.audio.audioFormat === "wav" ? "audio/wav" : "audio/mpeg",
          fileName: `voice-agent-output.${result.audio.audioFormat}`
        });
        this.lastAiAudioTranscript = audioTranscript;
      }
      if (expectedCorrection) {
        assert.match(normalizeText(result.json.chat_text_to_user), new RegExp(escapeRegExp(normalizeText(expectedCorrection))));
      }
      return { result, surfacedChatText, audioTranscript };
    },
    async turnSpeakOnWithoutNewInput() {
      if (this.speakEnabled) return;
      this.speakEnabled = true;
      if (this.lamp !== "red" || !this.lastCorrectionText) return;
      this.aiSpeechCalls += 1;
      const audio = await createSpeechAudio(this.lastCorrectionText);
      this.lastAiAudioTranscript = await transcribeAudio(audio);
    },
    noInputWhileSpeakAlreadyOn() {
      return;
    }
  };
}

function assertCorrectionStep(step: Awaited<ReturnType<ReturnType<typeof createFullAppHarness>["sendChatText"]>>, expected: string) {
  assert.equal(step.result.json.flags.has_corrections, true);
  assert.match(normalizeText(step.result.json.chat_text_to_user), new RegExp(escapeRegExp(normalizeText(expected))));
  assert.match(normalizeText(step.surfacedChatText), new RegExp(escapeRegExp(normalizeText(expected))));
}

function assertNoCorrectionStep(step: Awaited<ReturnType<ReturnType<typeof createFullAppHarness>["sendChatText"]>>) {
  assert.equal(step.result.json.flags.has_corrections, false);
  assert.equal(step.surfacedChatText, "");
  assert.equal(step.result.audio, null);
}

function assertInputAudioRepresentsBadPhrase(transcript: string) {
  const normalized = normalizeText(transcript);
  assert.match(normalized, /malade/);
  assert.doesNotMatch(normalized, /je suis malade/);
}

type TestAudio = {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
};

async function createSpeechAudio(text: string): Promise<TestAudio> {
  const speech = await DUMBB_TEXT_TO_SPEACH(
    { openAiApiKey: serverConfig().openAiApiKey },
    {
      model: serverConfig().ttsModel,
      text,
      voice: serverConfig().voice,
      languageName: "French",
      style: `Speak exactly this French learner sentence and do not correct it: ${text}`
    }
  );
  const buffer = await new Response(speech.body).arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    contentType: speech.contentType,
    fileName: speech.contentType.includes("wav") ? "test-input.wav" : "test-input.mp3"
  };
}

async function transcribeAudio(audio: TestAudio) {
  const formData = new FormData();
  const bytes = audio.bytes.slice();
  formData.set("file", new Blob([bytes.buffer], { type: audio.contentType }), audio.fileName);
  formData.set("model", "gpt-4o-mini-transcribe");
  const result = await DUMB_SPEACH_TO_TEXT_transcription({ openAiApiKey: serverConfig().openAiApiKey }, formData);
  return result.text;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
