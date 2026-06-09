import type { DebugPageDefinition } from "../debug_page_types";

export const APP_V2_DEBUG_PAGE: DebugPageDefinition = {
  id: "APP_V2_TEST",
  title: "App V2 test",
  module: "app_v2_test",
  role: "debug view of the production voice_agent_v2 app flow, prompts, correction events, speak decisions, and visible history",
  ready: true,
  inputs: [],
  actions: [{ id: "both", label: "Run App V2", requiresAudio: true }],
  output: [
    "visible chat text",
    "correction event level",
    "speak decision",
    "kept audio play button",
    "technical prompts",
    "safe visible history"
  ]
};
