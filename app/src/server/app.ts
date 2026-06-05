import type { CorrectionInput } from "../types";
import type { Env } from "./bindings";
import { addCost, readCosts, resetCosts } from "./costStore";
import { correctUtterance, providerSummaries } from "./trainer";

export async function listProviders() {
  return providerSummaries;
}

export async function getCostLedger(env: Env) {
  return readCosts(env.COST_DB);
}

export async function clearCostLedger(env: Env) {
  await resetCosts(env.COST_DB);
  return readCosts(env.COST_DB);
}

export async function runCorrection(input: CorrectionInput, env: Env) {
  const result = await correctUtterance(input, env);

  if (result.correction.shouldRespond) {
    await addCost(env.COST_DB, result.providerId, result.cost);
  }

  return result;
}
