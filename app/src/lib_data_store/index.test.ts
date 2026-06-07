import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLocalMemoryDataStore } from "./index";

describe("local-memory data store real method calls", () => {
  it("saves, lists, filters, and clears events without mocks", async () => {
    const store = createLocalMemoryDataStore();

    const savedDebug = await store.DATA_STORE_SAVE_EVENT({ type: "debug", scope: "unit", payload: { message: "debug event" } });
    const savedError = await store.DATA_STORE_SAVE_EVENT({ type: "error", scope: "unit", payload: { message: "error event" } });
    const all = await store.DATA_STORE_LIST_EVENTS();
    const debugOnly = await store.DATA_STORE_LIST_EVENTS({ type: "debug" });

    assert.equal(savedDebug.status.ok, true);
    assert.equal(savedError.status.ok, true);
    assert.equal(all.value.length, 2);
    assert.equal(debugOnly.value.length, 1);
    assert.equal(debugOnly.value[0].type, "debug");

    const clearDebug = await store.DATA_STORE_CLEAR_EVENTS({ type: "debug" });
    const afterClear = await store.DATA_STORE_LIST_EVENTS();

    assert.equal(clearDebug.status.ok, true);
    assert.deepEqual(afterClear.value.map((event) => event.type), ["error"]);
  });

  it("saves, lists, filters, and resets costs without mocks", async () => {
    const store = createLocalMemoryDataStore();

    await store.DATA_STORE_SAVE_COST({ provider: "openai", feature: "audio", amountUsd: 0.12, units: 2 });
    await store.DATA_STORE_SAVE_COST({ provider: "demo", feature: "audio", amountUsd: 0, units: 1 });

    const openAiCosts = await store.DATA_STORE_LIST_COSTS({ provider: "openai" });
    assert.equal(openAiCosts.status.ok, true);
    assert.equal(openAiCosts.value.length, 1);
    assert.equal(openAiCosts.value[0].amountUsd, 0.12);

    const resetOpenAi = await store.DATA_STORE_RESET_COSTS({ provider: "openai" });
    const remaining = await store.DATA_STORE_LIST_COSTS();

    assert.equal(resetOpenAi.status.ok, true);
    assert.deepEqual(remaining.value.map((cost) => cost.provider), ["demo"]);
  });
});
