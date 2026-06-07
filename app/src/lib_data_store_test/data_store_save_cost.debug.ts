import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_SAVE_COST_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_SAVE_COST",
  title: "Save cost",
  module: "lib_data_store_test",
  role: "usage -> stored cost/payment record",
  ready: true,
  inputs: [
    { key: "provider", label: "provider", kind: "text", defaultValue: "openai", required: true },
    { key: "feature", label: "feature", kind: "text", defaultValue: "manual-test", required: true },
    { key: "amountUsd", label: "amountUsd", kind: "number", defaultValue: 0 },
    { key: "units", label: "units", kind: "number", defaultValue: 1 },
    { key: "payload", label: "payload", kind: "json", defaultValue: "{}" }
  ],
  actions: [{ id: "text", label: "Save cost" }],
  output: ["status", "saved cost record"]
};
