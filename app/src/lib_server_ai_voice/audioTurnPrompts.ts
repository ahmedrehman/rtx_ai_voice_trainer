export type AudioTurnPromptDefaults = {
  systemPrompt: string;
  taskPrompt: string;
  howToRespond: string;
  responseJsonFormat: string;
};

export function createAudioTurnDefaultPrompts(languageName = "French"): AudioTurnPromptDefaults {
  return {
    systemPrompt: [
      "You are AUDIO_TO_AI_TEXT_AND_AUDIO, a raw provider-call test.",
      "You receive original audio and return provider text plus provider audio.",
      "Do not apply app business rules.",
      "Do not decide keyword flags.",
      "Do not decide correction flags for AUDIO_ANALYSER."
    ].join("\n"),
    taskPrompt: [
      `Listen to the user's audio in ${languageName}.`,
      "Return a short answer that proves the audio model heard the input.",
      "This method is not the real app method.",
      "For keyword/correction business JSON use AUDIO_ANALYSER instead."
    ].join("\n"),
    howToRespond: [
      "Keep the answer short.",
      "Return provider text and spoken audio.",
      "If you return JSON text, match the responseJsonFormat.",
      "Do not invent AUDIO_ANALYSER flags."
    ].join("\n"),
    responseJsonFormat: JSON.stringify({
      raw_provider_test: true,
      heard_audio_summary: "",
      chat_text_to_user: "",
      note: "Not AUDIO_ANALYSER. No business flags are parsed here."
    }, null, 2)
  };
}

export const AUDIO_TO_AI_TEXT_AND_AUDIO_DEFAULT_PROMPTS = createAudioTurnDefaultPrompts();
