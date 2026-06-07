import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_ANALYSER,
  AUDIO_ANALYSER_DEFAULT_PROMPTS,
  AUDIO_TO_AI_TEXT_AND_AUDIO,
  AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS,
  type ServerAiConfig
} from "./index";

type FetchCall = {
  url: string;
  body: unknown;
};

const originalFetch = globalThis.fetch;
let fetchCalls: FetchCall[] = [];
let nextAiText = "";
let nextAudioBase64 = "audio-base64-result";

beforeEach(() => {
  fetchCalls = [];
  nextAiText = "";
  nextAudioBase64 = "audio-base64-result";
  globalThis.fetch = mockAudioFetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AUDIO_TO_AI_TEXT_AND_AUDIO", () => {
  it("calls the raw audio provider method and returns provider text plus audio", async () => {
    nextAiText = JSON.stringify({
      raw_provider_test: true,
      heard_audio_summary: "heard sample audio",
      chat_text_to_user: "I heard the test audio.",
      note: "Not AUDIO_ANALYSER. No business flags are parsed here."
    });

    const output = await AUDIO_TO_AI_TEXT_AND_AUDIO(testConfig(), {
      provider: "openai",
      audioBase64: "input-audio-base64",
      audioFormat: "wav",
      systemPrompt: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.systemPrompt,
      taskPrompt: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.taskPrompt,
      responseJsonFormat: AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS.responseJsonFormat,
      voice: "coral"
    });

    assert.equal(output.status.ok, true);
    assert.equal(output.model, "gpt-audio");
    assert.equal(output.text, nextAiText);
    assert.equal(output.audioBase64, nextAudioBase64);
    assert.equal(output.audioFormat, "wav");
    assert.equal(fetchCalls.length, 1);

    const prompt = extractPrompt(fetchCalls[0].body);
    assert.match(prompt, /raw provider-call test/);
    assert.match(prompt, /not the real app method/i);
    assert.doesNotMatch(prompt, /keyword_on_sent/);
    assert.doesNotMatch(prompt, /has_corrections/);
  });
});

describe("AUDIO_ANALYSER", () => {
  it("uses the core business prompts and parses keyword/correction flags", async () => {
    nextAiText = JSON.stringify({
      flags: {
        keyword_on_sent: true,
        keyword_off_sent: false,
        keyword_detected: "on",
        keyword_exact_text: "on",
        has_corrections: true,
        correction_type: "pronunciation",
        is_chat_answer_or_correction: "correction"
      },
      chat_text_to_user: "Say bonjour with a softer j sound.",
      text_corrected: "Bonjour.",
      hint: "Soften the middle consonant."
    });

    const output = await AUDIO_ANALYSER(testConfig(), {
      provider: "openai",
      systemPrompt: AUDIO_ANALYSER_DEFAULT_PROMPTS,
      textUserChat: "Please check my sentence.",
      audioUserAudio: {
        audioBase64: "input-audio-base64",
        audioFormat: "wav"
      },
      history5LastTextChats: ["previous sentence"],
      voice: "coral"
    });

    assert.equal(output.status.ok, true);
    assert.deepEqual(output.json.flags, {
      keyword_on_sent: true,
      keyword_off_sent: false,
      keyword_detected: "on",
      keyword_exact_text: "on",
      has_corrections: true,
      correction_type: "pronunciation",
      is_chat_answer_or_correction: "correction"
    });
    assert.equal(output.json.chat_text_to_user, "Say bonjour with a softer j sound.");
    assert.equal(output.json.text_corrected, "Bonjour.");
    assert.equal(output.json.hint, "Soften the middle consonant.");
    assert.equal(output.audio?.audioBase64, nextAudioBase64);
    assert.equal(output.debug.rawAiText, nextAiText);

    const prompt = extractPrompt(fetchCalls[0].body);
    assert.match(prompt, /You are AUDIO_ANALYSER/);
    assert.match(prompt, /Keyword ON exact word\/phrase: on/);
    assert.match(prompt, /Keyword OFF exact word\/phrase: off/);
    assert.match(prompt, /keyword_on_sent/);
    assert.match(prompt, /correction_type/);
    assert.match(prompt, /HISTORY 5 LAST TEXT CHATS/);
  });

  it("returns a clear error status when required audio is missing", async () => {
    const output = await AUDIO_ANALYSER(testConfig(), {
      provider: "openai",
      systemPrompt: AUDIO_ANALYSER_DEFAULT_PROMPTS,
      textUserChat: "",
      audioUserAudio: {
        audioBase64: "",
        audioFormat: "wav"
      },
      history5LastTextChats: []
    });

    assert.equal(output.status.ok, false);
    assert.equal(output.status.phase, "error");
    assert.match(output.status.error || "", /requires original microphone audio/);
    assert.equal(output.audio, null);
    assert.equal(output.json.flags.keyword_on_sent, false);
    assert.equal(output.json.flags.keyword_off_sent, false);
    assert.equal(fetchCalls.length, 0);
  });
});

function testConfig(): ServerAiConfig {
  return {
    provider: "openai",
    implementation: "openai-audio",
    openAiApiKey: "test-key",
    audioModel: "gpt-audio",
    voice: "coral"
  };
}

async function mockAudioFetch(url: string | URL | Request, init?: RequestInit) {
  const body = JSON.parse(String(init?.body || "{}"));
  fetchCalls.push({ url: String(url), body });

  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content: nextAiText,
          audio: {
            data: nextAudioBase64,
            transcript: nextAiText
          }
        }
      }
    ]
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function extractPrompt(requestBody: unknown) {
  const body = requestBody as {
    messages?: Array<{
      content?: Array<{ type: string; text?: string }>;
    }>;
  };
  return body.messages?.[0]?.content?.find((item) => item.type === "text")?.text || "";
}
