import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_STREAM_TEXT_CHAT_DEBUG_PAGE: DebugPageDefinition = {
  id: "VOICE_AGENT_STREAM_TEXT_CHAT_TEST",
  title: "Voice agent streaming text only",
  module: "voice_agent_frontend_test",
  role: "typed text -> streamed answer text tokens only. No audio streaming.",
  ready: true,
  inputs: [
    {
      key: "textUserChat",
      label: "textUserChat",
      kind: "textarea",
      required: true,
      defaultValue: "Bonjour, je veux pratiquer le francais.",
      note: "Latest typed user message. The stream method answers this message only."
    },
    {
      key: "history5LastTextChats",
      label: "history5LastTextChats",
      kind: "json",
      defaultValue: "[]",
      note: "Last five text chats. Context only; not the answer target."
    },
    {
      key: "systemPrompt",
      label: "systemPrompt",
      kind: "textarea",
      required: true,
      note: "Server builds the stream system prompt from voice_agent settings."
    },
    {
      key: "userPrompt",
      label: "userPrompt",
      kind: "textarea",
      required: true,
      note: "Server prompt containing topic, latest text, and history context."
    }
  ],
  actions: [
    {
      id: "text",
      label: "Run streaming text only"
    }
  ],
  output: [
    "status",
    "stream events",
    "delta text",
    "final text",
    "debug.input",
    "debug.promptSent"
  ]
};
