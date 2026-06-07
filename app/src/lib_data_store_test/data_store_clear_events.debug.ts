import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_CLEAR_EVENTS_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_CLEAR_EVENTS",
  title: "Clear events",
  module: "lib_data_store_test",
  role: "filter -> clear event records",
  ready: true,
  inputs: [
    { key: "type", label: "type", kind: "select", defaultValue: "", options: ["", "debug", "error", "history", "payment", "cost"] }
  ],
  actions: [{ id: "text", label: "Clear events" }],
  output: ["status"]
};
