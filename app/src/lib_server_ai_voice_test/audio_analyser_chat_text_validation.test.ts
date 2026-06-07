import assert from "node:assert/strict";
import test from "node:test";
import { validateAudioAnalyserChatText } from "../lib_server_ai_voice";

test("AUDIO_ANALYSER rejects internal process text instead of showing it as chat", () => {
  const badAnswers = [
    "Sure. I need to listen to the audio in order to analyze the pronunciation and accent.",
    "Please provide the original microphone audio so I can process it.",
    "I'm ready to analyze the audio and provide feedback. Please upload the original microphone audio to proceed.",
    "I'm unable to analyze audio directly. Please provide the original microphone audio input.",
    "Once the audio is provided, I will process it and return the JSON response."
  ];

  for (const answer of badAnswers) {
    assert.throws(
      () => validateAudioAnalyserChatText(answer),
      /internal process text/,
      answer
    );
  }
});

test("AUDIO_ANALYSER accepts a short user-facing answer", () => {
  assert.equal(validateAudioAnalyserChatText("Ca va bien, merci. Et toi ?"), "Ca va bien, merci. Et toi ?");
});
