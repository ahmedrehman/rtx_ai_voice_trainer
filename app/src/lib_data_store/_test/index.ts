export type DataStoreTestId =
  | "DATA_STORE_SAVE_EVENT"
  | "DATA_STORE_LIST_EVENTS"
  | "DATA_STORE_CLEAR_EVENTS"
  | "DATA_STORE_SAVE_COST"
  | "DATA_STORE_LIST_COSTS"
  | "DATA_STORE_RESET_COSTS";

export type DataStoreTest = {
  id: DataStoreTestId;
  title: string;
  role: string;
  input: string[];
  output: string[];
};

export const DATA_STORE_TESTS: DataStoreTest[] = [
  {
    id: "DATA_STORE_SAVE_EVENT",
    title: "Save debug event",
    role: "payload -> stored event",
    input: ["type", "scope", "payload"],
    output: ["saved record"]
  },
  {
    id: "DATA_STORE_LIST_EVENTS",
    title: "List debug events",
    role: "store -> event array",
    input: ["optional type", "limit"],
    output: ["record array"]
  },
  {
    id: "DATA_STORE_CLEAR_EVENTS",
    title: "Clear debug events",
    role: "filter -> delete events",
    input: ["optional type"],
    output: ["none"]
  },
  {
    id: "DATA_STORE_SAVE_COST",
    title: "Save cost/payment",
    role: "usage -> stored cost",
    input: ["provider", "feature", "amountUsd", "units"],
    output: ["saved cost record"]
  },
  {
    id: "DATA_STORE_LIST_COSTS",
    title: "List costs/payments",
    role: "store -> cost array",
    input: ["optional provider", "limit"],
    output: ["cost array"]
  },
  {
    id: "DATA_STORE_RESET_COSTS",
    title: "Reset costs/payments",
    role: "filter -> delete costs",
    input: ["optional provider"],
    output: ["none"]
  }
];

export const DATA_STORE_DEBUG_PAGES: DebugPageDefinition[] = [
  {
    id: "DATA_STORE_SAVE_EVENT",
    title: "Save event",
    module: "Data Store",
    role: "payload -> stored debug/history/error event",
    ready: true,
    inputs: [
      { key: "type", label: "type", kind: "select", defaultValue: "debug", options: ["debug", "error", "history", "payment", "cost"], required: true },
      { key: "scope", label: "scope", kind: "text", defaultValue: "manual" },
      { key: "payload", label: "payload", kind: "json", defaultValue: "{\n  \"note\": \"manual debug event\"\n}", required: true }
    ],
    actions: [{ id: "text", label: "Save event" }],
    output: ["status", "saved record"]
  },
  {
    id: "DATA_STORE_LIST_EVENTS",
    title: "List events",
    module: "Data Store",
    role: "store -> event array",
    ready: true,
    inputs: [
      { key: "type", label: "type", kind: "select", defaultValue: "", options: ["", "debug", "error", "history", "payment", "cost"] },
      { key: "limit", label: "limit", kind: "number", defaultValue: 20 }
    ],
    actions: [{ id: "text", label: "List events" }],
    output: ["status", "record array"]
  },
  {
    id: "DATA_STORE_CLEAR_EVENTS",
    title: "Clear events",
    module: "Data Store",
    role: "filter -> clear event records",
    ready: true,
    inputs: [
      { key: "type", label: "type", kind: "select", defaultValue: "", options: ["", "debug", "error", "history", "payment", "cost"] }
    ],
    actions: [{ id: "text", label: "Clear events" }],
    output: ["status"]
  },
  {
    id: "DATA_STORE_SAVE_COST",
    title: "Save cost",
    module: "Data Store",
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
  },
  {
    id: "DATA_STORE_LIST_COSTS",
    title: "List costs",
    module: "Data Store",
    role: "store -> cost/payment array",
    ready: true,
    inputs: [
      { key: "provider", label: "provider", kind: "text", defaultValue: "" },
      { key: "limit", label: "limit", kind: "number", defaultValue: 20 }
    ],
    actions: [{ id: "text", label: "List costs" }],
    output: ["status", "cost array"]
  },
  {
    id: "DATA_STORE_RESET_COSTS",
    title: "Reset costs",
    module: "Data Store",
    role: "filter -> clear cost/payment records",
    ready: true,
    inputs: [
      { key: "provider", label: "provider", kind: "text", defaultValue: "" }
    ],
    actions: [{ id: "text", label: "Reset costs" }],
    output: ["status"]
  }
];
import type { DebugPageDefinition } from "../../debug_page_types";
