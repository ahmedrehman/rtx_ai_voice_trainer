import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCloudflareD1DataStore, createLocalMemoryDataStore, type D1DatabaseLike } from "./index";

describe("createLocalMemoryDataStore", () => {
  it("saves, lists, filters, and clears events", async () => {
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

  it("saves, lists, filters, and resets costs", async () => {
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

describe("createCloudflareD1DataStore", () => {
  it("uses D1 statements for event and cost methods", async () => {
    const d1 = createFakeD1();
    const store = createCloudflareD1DataStore(d1);

    const savedEvent = await store.DATA_STORE_SAVE_EVENT({ id: "event-1", createdAt: "2026-01-01T00:00:00.000Z", type: "debug", scope: "unit", payload: { ok: true } });
    const listedEvents = await store.DATA_STORE_LIST_EVENTS({ type: "debug", limit: 5 });
    const clearedEvents = await store.DATA_STORE_CLEAR_EVENTS({ type: "debug" });
    const savedCost = await store.DATA_STORE_SAVE_COST({ id: "cost-1", createdAt: "2026-01-01T00:00:00.000Z", provider: "openai", feature: "audio", amountUsd: 0.5, units: 3, payload: { model: "test" } });
    const listedCosts = await store.DATA_STORE_LIST_COSTS({ provider: "openai", limit: 5 });
    const resetCosts = await store.DATA_STORE_RESET_COSTS({ provider: "openai" });

    assert.equal(savedEvent.status.ok, true);
    assert.equal(savedEvent.value.id, "event-1");
    const listedEventPayload = listedEvents.value[0].payload as { ok: boolean };
    assert.equal(listedEventPayload.ok, true);
    assert.equal(clearedEvents.status.ok, true);
    assert.equal(savedCost.status.ok, true);
    assert.equal(savedCost.value.amountUsd, 0.5);
    assert.equal(listedCosts.value[0].provider, "openai");
    assert.equal(resetCosts.status.ok, true);
    assert.equal(d1.calls.length, 6);
  });

  it("rejects when D1 fails", async () => {
    const store = createCloudflareD1DataStore(createFailingD1());

    await assert.rejects(
      () => store.DATA_STORE_SAVE_EVENT({ type: "debug", payload: {} }),
      /D1 failed/
    );
  });
});

function createFakeD1(): D1DatabaseLike & { calls: Array<{ sql: string; values: unknown[] }> } {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          calls.push({ sql, values });
          return {
            async run() {
              return {};
            },
            async all<T>() {
              const lowerSql = sql.toLowerCase();
              const results = lowerSql.includes("voice_trainer_events")
                ? [{
                    id: "event-1",
                    type: "debug",
                    scope: "unit",
                    payload_json: "{\"ok\":true}",
                    created_at: "2026-01-01T00:00:00.000Z"
                  }]
                : [{
                    id: "cost-1",
                    provider: "openai",
                    feature: "audio",
                    amount_usd: 0.5,
                    units: 3,
                    payload_json: "{\"model\":\"test\"}",
                    created_at: "2026-01-01T00:00:00.000Z"
                  }];
              return { results: results as T[] };
            }
          };
        }
      };
    }
  };
}

function createFailingD1(): D1DatabaseLike {
  return {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              throw new Error("D1 failed");
            },
            async all() {
              throw new Error("D1 failed");
            }
          };
        }
      };
    }
  };
}
