import type { DebugPageDefinition } from "../debug_page_types";

export const VOICE_AGENT_DEBUG_PAGES: DebugPageDefinition[] = [
  {
    id: "VOICE_AGENT_TEXT_CHAT_TEST",
    title: "Voice agent text chat",
    module: "Voice Agent",
    role: "typed text + prompts -> JSON chat answer and optional audio",
    ready: true,
    inputs: [
      {
        key: "textUserChat",
        label: "textUserChat",
        kind: "textarea",
        required: true,
        defaultValue: "Bonjour, je veux pratiquer le francais.",
        note: "Latest typed user message. This is the only text the method must answer."
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
        note: "Top-level AI instruction built from voice_agent prompt configuration."
      },
      {
        key: "taskPrompt",
        label: "taskPrompt",
        kind: "textarea",
        required: true,
        note: "Business task: answer/correct latest text, detect exact keywords, return JSON."
      },
      {
        key: "responseJsonFormat",
        label: "responseJsonFormat",
        kind: "json",
        required: true,
        note: "Requested JSON fields for flags, answer text, corrected text, and hint."
      },
      {
        key: "speakEnabled",
        label: "speakEnabled",
        kind: "select",
        options: ["false", "true"],
        defaultValue: "false",
        note: "When true, the method also creates audio from chat_text_to_user."
      }
    ],
    actions: [
      {
        id: "text",
        label: "Run text chat"
      }
    ],
    output: [
      "status",
      "json.flags",
      "json.chat_text_to_user",
      "json.text_corrected",
      "json.hint",
      "audio",
      "debug.input",
      "debug.promptSent",
      "debug.rawAiText"
    ]
  }
];
