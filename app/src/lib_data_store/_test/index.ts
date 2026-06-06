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
