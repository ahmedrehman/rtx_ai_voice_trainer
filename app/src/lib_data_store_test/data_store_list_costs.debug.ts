import type { DebugPageDefinition } from "../debug_page_types";

export const DATA_STORE_LIST_COSTS_DEBUG_PAGE: DebugPageDefinition = {
  id: "DATA_STORE_LIST_COSTS",
  title: "List costs",
  module: "lib_data_store_test",
  role: "store -> cost/payment array",
  ready: true,
  inputs: [
    { key: "provider", label: "provider", kind: "text", defaultValue: "" },
    { key: "limit", label: "limit", kind: "number", defaultValue: 20 }
  ],
  actions: [{ id: "text", label: "List costs" }],
  output: ["status", "cost array"]
};
