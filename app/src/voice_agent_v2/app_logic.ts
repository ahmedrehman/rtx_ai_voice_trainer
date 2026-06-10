import type { VoiceAgentChatMessage } from "../voice_agent";
import type { VoiceAgentV2CorrectionLevel, VoiceAgentV2Signal } from ".";

export type VoiceAgentV2AppTurnInput = {
  source: "text" | "voice";
  listenOn: boolean;
  speakOn: boolean;
  freeChatOn: boolean;
  speakLevel: 1 | 2 | 3;
  userText: string;
  aiText: string;
  correctedText?: string;
  correctionLevel: VoiceAgentV2CorrectionLevel | null;
  audioAvailable: boolean;
};

export type VoiceAgentV2AppTurnDecision = {
  status: "none" | VoiceAgentV2Signal;
  signal: VoiceAgentV2Signal;
  chatMessages: Array<Pick<VoiceAgentChatMessage, "role" | "text"> & { audioLink: boolean }>;
  assistantText: string;
  shouldAutoPlayAudio: boolean;
  shouldKeepAudioLink: boolean;
};

export function VOICE_AGENT_V2_DECIDE_APP_TURN(input: VoiceAgentV2AppTurnInput): VoiceAgentV2AppTurnDecision {
  const userText = cleanText(input.userText);
  const aiText = stripSignalCodeword(cleanText(input.aiText));
  const correctedText = stripSignalCodeword(cleanText(input.correctedText || input.aiText));
  const isVoiceTurn = input.source === "voice" || input.listenOn;

  if (input.freeChatOn) {
    const assistantText = aiText || correctedText || "OK";
    return {
      status: "none",
      signal: "green",
      assistantText,
      shouldAutoPlayAudio: Boolean(input.speakOn && input.audioAvailable),
      shouldKeepAudioLink: false,
      chatMessages: createChatMessages({ isVoiceTurn, userText, assistantText, audioLink: false })
    };
  }

  const level = normalizeLevel(input.correctionLevel);
  const signal = signalFromLevel(level);
  const assistantText = correctionModeAssistantText({
    level,
    userText,
    correctedText,
    aiText
  });
  const shouldKeepAudioLink = Boolean(isVoiceTurn && input.audioAvailable && level > 0);
  const shouldAutoPlayAudio = Boolean(input.speakOn && input.audioAvailable && level > 0 && level >= input.speakLevel);

  return {
    status: signal,
    signal,
    assistantText,
    shouldAutoPlayAudio,
    shouldKeepAudioLink,
    chatMessages: createChatMessages({ isVoiceTurn, userText, assistantText, audioLink: shouldKeepAudioLink })
  };
}

export function VOICE_AGENT_V2_SHOULD_STREAM_AUDIO_IMMEDIATELY(input: {
  freeChatOn: boolean;
  speakOn: boolean;
}) {
  return Boolean(input.freeChatOn && input.speakOn);
}

export function VOICE_AGENT_V2_SHOULD_SPEAK_LEVEL(input: {
  correctionLevel: VoiceAgentV2CorrectionLevel | number | null | undefined;
  speakOn: boolean;
  speakLevel: 1 | 2 | 3;
}) {
  const level = normalizeLevel(input.correctionLevel);
  return Boolean(input.speakOn && level > 0 && level >= input.speakLevel);
}

export function VOICE_AGENT_V2_STRIP_SIGNAL_CODEWORD(text: string) {
  return stripSignalCodeword(text);
}

function correctionModeAssistantText(input: {
  level: VoiceAgentV2CorrectionLevel;
  userText: string;
  correctedText: string;
  aiText: string;
}) {
  if (input.level === 0) return okText(input.userText || input.aiText);
  if (input.level === 1 && (!input.correctedText || sameText(input.correctedText, input.userText))) {
    return okText(input.userText || input.correctedText || input.aiText);
  }
  return `Correction: ${input.correctedText || input.aiText || input.userText || "Correction"}`;
}

function okText(text: string) {
  return text ? `OK: ${text}` : "OK";
}

function createChatMessages(input: {
  isVoiceTurn: boolean;
  userText: string;
  assistantText: string;
  audioLink: boolean;
}) {
  const messages: VoiceAgentV2AppTurnDecision["chatMessages"] = [];
  if (input.isVoiceTurn && input.userText) {
    messages.push({ role: "user", text: input.userText, audioLink: false });
  }
  messages.push({ role: "assistant", text: input.assistantText, audioLink: input.audioLink });
  return messages;
}

function normalizeLevel(level: VoiceAgentV2CorrectionLevel | number | null | undefined): VoiceAgentV2CorrectionLevel {
  return level === 1 || level === 2 || level === 3 ? level : 0;
}

function signalFromLevel(level: VoiceAgentV2CorrectionLevel): VoiceAgentV2Signal {
  if (level === 1) return "yellow";
  if (level === 2) return "orange";
  if (level === 3) return "red";
  return "green";
}

function stripSignalCodeword(text: string) {
  return text.replace(/^\s*(signal\s*(?:vert|jaune|orange|rouge)|signal(?:vert|jaune|orange|rouge))\b\s*[:,-]?\s*/i, "").trim();
}

function cleanText(text: string) {
  return String(text || "").trim();
}

function sameText(left: string, right: string) {
  return cleanText(left).toLocaleLowerCase() === cleanText(right).toLocaleLowerCase();
}
