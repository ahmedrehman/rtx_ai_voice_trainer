import type { CostBucket, CostLedger, ProviderId } from "../types";
import type { D1DatabaseLike } from "./bindings";
import { defaultLedger } from "./trainer";

type CostRow = {
  provider_id: ProviderId;
  turns: number;
  estimated_cost: number;
  stt_cost: number;
  correction_cost: number;
  tts_cost: number;
};

export async function addCost(db: D1DatabaseLike | undefined, providerId: ProviderId, cost: CostBucket) {
  if (!db) return;
  await ensureSchema(db);

  await db.prepare(
    `insert into provider_costs (
      provider_id,
      turns,
      estimated_cost,
      stt_cost,
      correction_cost,
      tts_cost,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, datetime('now'))
    on conflict(provider_id) do update set
      turns = turns + excluded.turns,
      estimated_cost = estimated_cost + excluded.estimated_cost,
      stt_cost = stt_cost + excluded.stt_cost,
      correction_cost = correction_cost + excluded.correction_cost,
      tts_cost = tts_cost + excluded.tts_cost,
      updated_at = datetime('now')`
  ).bind(
    providerId,
    cost.turns,
    cost.estimatedCost,
    cost.sttCost,
    cost.correctionCost,
    cost.ttsCost
  ).run();
}

export async function readCosts(db: D1DatabaseLike | undefined): Promise<CostLedger> {
  const ledger = structuredClone(defaultLedger);
  if (!db) return ledger;
  await ensureSchema(db);

  const rows = await db.prepare(
    `select
      provider_id,
      turns,
      estimated_cost,
      stt_cost,
      correction_cost,
      tts_cost
    from provider_costs`
  ).all<CostRow>();

  for (const row of rows.results || []) {
    ledger[row.provider_id] = {
      turns: row.turns,
      estimatedCost: row.estimated_cost,
      sttCost: row.stt_cost,
      correctionCost: row.correction_cost,
      ttsCost: row.tts_cost
    };
  }

  return ledger;
}

export async function resetCosts(db: D1DatabaseLike | undefined) {
  if (!db) return;
  await ensureSchema(db);
  await db.prepare("delete from provider_costs").run();
}

async function ensureSchema(db: D1DatabaseLike) {
  await db.prepare(
    `create table if not exists provider_costs (
      provider_id text primary key,
      turns integer not null default 0,
      estimated_cost real not null default 0,
      stt_cost real not null default 0,
      correction_cost real not null default 0,
      tts_cost real not null default 0,
      updated_at text not null default (datetime('now'))
    )`
  ).run();
}
