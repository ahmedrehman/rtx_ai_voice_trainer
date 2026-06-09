import type { VoiceAgentSettings } from "../voice_agent";

export function VOICE_AGENT_REALTIME_CREATE_INSTRUCTIONS(settings: VoiceAgentSettings) {
  return [
    "You are the realtime speech-to-speech debug test for AI Voice Trainer.",
    `Target language: ${settings.languageName}.`,
    `Topic: ${settings.topic}.`,
    `Control phrase on: ${settings.keywordOn}.`,
    `Control phrase off: ${settings.keywordOff}.`,
    "Keep responses very short.",
    "If you hear your own previous answer through the microphone, ignore it and stay silent.",
    "For French practice, give one corrected phrase and one tiny hint.",
    "Do not mention JSON, debug logs, internal tools, or implementation details."
  ].join("\n");
}

export function VOICE_AGENT_REALTIME_NORMALIZE_VOICE(value: string) {
  const normalized = value.toLowerCase().trim();
  if (["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"].includes(normalized)) {
    return normalized;
  }
  return "marin";
}
