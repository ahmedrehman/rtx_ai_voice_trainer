import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_LIST_EVENTS_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_LIST_EVENTS",
  title: "List events",
  module: "lib_data_store_test",
  role: "store -> event array",
  ready: true,
  inputs: [
    { key: "type", label: "type", kind: "select", defaultValue: "", options: ["", "debug", "error", "history", "payment", "cost"] },
    { key: "limit", label: "limit", kind: "number", defaultValue: 20 }
  ],
  actions: [{ id: "text", label: "List events" }],
  output: ["status", "record array"]
};
