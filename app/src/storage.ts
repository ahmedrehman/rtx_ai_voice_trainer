import { defaultLedger, defaultSettings } from "./clientConfig";
import type { AppSettings, CostLedger } from "./types";

const settingsKey = "voice-trainer-settings";
const costsKey = "voice-trainer-costs";

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(settingsKey);
  if (!raw) return defaultSettings;

  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function loadLedger(): CostLedger {
  const raw = localStorage.getItem(costsKey);
  if (!raw) return defaultLedger;

  try {
    return { ...defaultLedger, ...JSON.parse(raw) };
  } catch {
    return defaultLedger;
  }
}

export function saveLedger(ledger: CostLedger) {
  localStorage.setItem(costsKey, JSON.stringify(ledger));
}

export function clearLedger() {
  localStorage.removeItem(costsKey);
}
