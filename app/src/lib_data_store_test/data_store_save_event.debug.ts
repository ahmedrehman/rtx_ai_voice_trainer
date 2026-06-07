import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_SAVE_EVENT_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_SAVE_EVENT",
  title: "Save event",
  module: "lib_data_store_test",
  role: "payload -> stored debug/history/error event",
  ready: true,
  inputs: [
    { key: "type", label: "type", kind: "select", defaultValue: "debug", options: ["debug", "error", "history", "payment", "cost"], required: true },
    { key: "scope", label: "scope", kind: "text", defaultValue: "manual" },
    { key: "payload", label: "payload", kind: "json", defaultValue: "{\n  \"note\": \"manual debug event\"\n}", required: true }
  ],
  actions: [{ id: "text", label: "Save event" }],
  output: ["status", "saved record"]
};
