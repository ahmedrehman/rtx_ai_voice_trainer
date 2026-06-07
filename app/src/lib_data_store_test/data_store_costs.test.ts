import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLocalMemoryDataStore } from "../lib_data_store";

describe("lib_data_store_test costs", () => {
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
