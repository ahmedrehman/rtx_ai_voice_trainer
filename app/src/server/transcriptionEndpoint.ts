import { DUMB_SPEACH_TO_TEXT_transcription } from "../mod_ai_calls";

export const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

export async function transcribeOpenAiFormData(openAiApiKey: string, formData: FormData) {
  if (!formData.has("model")) {
    formData.set("model", DEFAULT_TRANSCRIPTION_MODEL);
  }

  return DUMB_SPEACH_TO_TEXT_transcription({ openAiApiKey }, formData);
}
