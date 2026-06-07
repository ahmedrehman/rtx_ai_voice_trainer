import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_RESET_COSTS_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_RESET_COSTS",
  title: "Reset costs",
  module: "lib_data_store_test",
  role: "filter -> clear cost/payment records",
  ready: true,
  inputs: [
    { key: "provider", label: "provider", kind: "text", defaultValue: "" }
  ],
  actions: [{ id: "text", label: "Reset costs" }],
  output: ["status"]
};
