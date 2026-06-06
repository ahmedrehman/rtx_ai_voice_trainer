export type DataStoreImplementation = "local-memory" | "cloudflare-d1";

export type DataStoreRecordType = "debug" | "cost" | "payment" | "history" | "error";

export type DataStoreRecord = {
  id: string;
  type: DataStoreRecordType;
  scope?: string;
  payload: unknown;
  createdAt: string;
};

export type DataStoreCost = {
  id: string;
  provider: string;
  feature: string;
  amountUsd: number;
  units?: number;
  payload?: unknown;
  createdAt: string;
};

export type DataStoreLogEvent = {
  level: "info" | "error";
  method: string;
  message: string;
  data?: unknown;
  createdAt: string;
};

export type DataStoreLogger = (event: DataStoreLogEvent) => void;

export type MethodStatus = {
  method: string;
  ok: boolean;
  phase: "done" | "error";
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type DataStoreResult<T> = {
  status: MethodStatus;
  value: T;
};

export type D1DatabaseLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
    };
  };
};

export type DataStore = {
  implementation: DataStoreImplementation;
  DATA_STORE_SAVE_EVENT(record: Omit<DataStoreRecord, "id" | "createdAt"> & Partial<Pick<DataStoreRecord, "id" | "createdAt">>): Promise<DataStoreResult<DataStoreRecord>>;
  DATA_STORE_LIST_EVENTS(filter?: { type?: DataStoreRecordType; limit?: number }): Promise<DataStoreResult<DataStoreRecord[]>>;
  DATA_STORE_CLEAR_EVENTS(filter?: { type?: DataStoreRecordType }): Promise<DataStoreResult<null>>;
  DATA_STORE_SAVE_COST(cost: Omit<DataStoreCost, "id" | "createdAt"> & Partial<Pick<DataStoreCost, "id" | "createdAt">>): Promise<DataStoreResult<DataStoreCost>>;
  DATA_STORE_LIST_COSTS(filter?: { provider?: string; limit?: number }): Promise<DataStoreResult<DataStoreCost[]>>;
  DATA_STORE_RESET_COSTS(filter?: { provider?: string }): Promise<DataStoreResult<null>>;
};

export function createLocalMemoryDataStore(logger?: DataStoreLogger): DataStore {
  const events: DataStoreRecord[] = [];
  const costs: DataStoreCost[] = [];

  return {
    implementation: "local-memory",
    async DATA_STORE_SAVE_EVENT(record) {
      const startedAt = new Date().toISOString();
      const saved = { id: record.id || createId(), createdAt: record.createdAt || new Date().toISOString(), ...record };
      events.unshift(saved);
      log(logger, "info", "DATA_STORE_SAVE_EVENT", "saved", saved);
      return { status: doneStatus("DATA_STORE_SAVE_EVENT", startedAt), value: saved };
    },
    async DATA_STORE_LIST_EVENTS(filter = {}) {
      const startedAt = new Date().toISOString();
      return {
        status: doneStatus("DATA_STORE_LIST_EVENTS", startedAt),
        value: events.filter((event) => !filter.type || event.type === filter.type).slice(0, filter.limit || 100)
      };
    },
    async DATA_STORE_CLEAR_EVENTS(filter = {}) {
      const startedAt = new Date().toISOString();
      const keep = events.filter((event) => filter.type && event.type !== filter.type);
      events.splice(0, events.length, ...keep);
      log(logger, "info", "DATA_STORE_CLEAR_EVENTS", "cleared", filter);
      return { status: doneStatus("DATA_STORE_CLEAR_EVENTS", startedAt), value: null };
    },
    async DATA_STORE_SAVE_COST(cost) {
      const startedAt = new Date().toISOString();
      const saved = { id: cost.id || createId(), createdAt: cost.createdAt || new Date().toISOString(), ...cost };
      costs.unshift(saved);
      log(logger, "info", "DATA_STORE_SAVE_COST", "saved", saved);
      return { status: doneStatus("DATA_STORE_SAVE_COST", startedAt), value: saved };
    },
    async DATA_STORE_LIST_COSTS(filter = {}) {
      const startedAt = new Date().toISOString();
      return {
        status: doneStatus("DATA_STORE_LIST_COSTS", startedAt),
        value: costs.filter((cost) => !filter.provider || cost.provider === filter.provider).slice(0, filter.limit || 100)
      };
    },
    async DATA_STORE_RESET_COSTS(filter = {}) {
      const startedAt = new Date().toISOString();
      const keep = costs.filter((cost) => filter.provider && cost.provider !== filter.provider);
      costs.splice(0, costs.length, ...keep);
      log(logger, "info", "DATA_STORE_RESET_COSTS", "reset", filter);
      return { status: doneStatus("DATA_STORE_RESET_COSTS", startedAt), value: null };
    }
  };
}

export function createCloudflareD1DataStore(d1: D1DatabaseLike, logger?: DataStoreLogger): DataStore {
  return {
    implementation: "cloudflare-d1",
    async DATA_STORE_SAVE_EVENT(record) {
      const startedAt = new Date().toISOString();
      const saved = { id: record.id || createId(), createdAt: record.createdAt || new Date().toISOString(), ...record };
      await d1.prepare("insert into voice_trainer_events (id, type, scope, payload_json, created_at) values (?, ?, ?, ?, ?)")
        .bind(saved.id, saved.type, saved.scope || "", JSON.stringify(saved.payload), saved.createdAt)
        .run();
      log(logger, "info", "DATA_STORE_SAVE_EVENT", "saved", withoutPayload(saved));
      return { status: doneStatus("DATA_STORE_SAVE_EVENT", startedAt), value: saved };
    },
    async DATA_STORE_LIST_EVENTS(filter = {}) {
      const startedAt = new Date().toISOString();
      const rows = await d1.prepare(
        filter.type
          ? "select id, type, scope, payload_json, created_at from voice_trainer_events where type = ? order by created_at desc limit ?"
          : "select id, type, scope, payload_json, created_at from voice_trainer_events order by created_at desc limit ?"
      ).bind(...(filter.type ? [filter.type, filter.limit || 100] : [filter.limit || 100])).all<D1EventRow>();
      return { status: doneStatus("DATA_STORE_LIST_EVENTS", startedAt), value: (rows.results || []).map(eventFromD1) };
    },
    async DATA_STORE_CLEAR_EVENTS(filter = {}) {
      const startedAt = new Date().toISOString();
      if (filter.type) {
        await d1.prepare("delete from voice_trainer_events where type = ?").bind(filter.type).run();
      } else {
        await d1.prepare("delete from voice_trainer_events").bind().run();
      }
      log(logger, "info", "DATA_STORE_CLEAR_EVENTS", "cleared", filter);
      return { status: doneStatus("DATA_STORE_CLEAR_EVENTS", startedAt), value: null };
    },
    async DATA_STORE_SAVE_COST(cost) {
      const startedAt = new Date().toISOString();
      const saved = { id: cost.id || createId(), createdAt: cost.createdAt || new Date().toISOString(), ...cost };
      await d1.prepare("insert into voice_trainer_costs (id, provider, feature, amount_usd, units, payload_json, created_at) values (?, ?, ?, ?, ?, ?, ?)")
        .bind(saved.id, saved.provider, saved.feature, saved.amountUsd, saved.units || 0, JSON.stringify(saved.payload || null), saved.createdAt)
        .run();
      log(logger, "info", "DATA_STORE_SAVE_COST", "saved", withoutPayload(saved));
      return { status: doneStatus("DATA_STORE_SAVE_COST", startedAt), value: saved };
    },
    async DATA_STORE_LIST_COSTS(filter = {}) {
      const startedAt = new Date().toISOString();
      const rows = await d1.prepare(
        filter.provider
          ? "select id, provider, feature, amount_usd, units, payload_json, created_at from voice_trainer_costs where provider = ? order by created_at desc limit ?"
          : "select id, provider, feature, amount_usd, units, payload_json, created_at from voice_trainer_costs order by created_at desc limit ?"
      ).bind(...(filter.provider ? [filter.provider, filter.limit || 100] : [filter.limit || 100])).all<D1CostRow>();
      return { status: doneStatus("DATA_STORE_LIST_COSTS", startedAt), value: (rows.results || []).map(costFromD1) };
    },
    async DATA_STORE_RESET_COSTS(filter = {}) {
      const startedAt = new Date().toISOString();
      if (filter.provider) {
        await d1.prepare("delete from voice_trainer_costs where provider = ?").bind(filter.provider).run();
      } else {
        await d1.prepare("delete from voice_trainer_costs").bind().run();
      }
      log(logger, "info", "DATA_STORE_RESET_COSTS", "reset", filter);
      return { status: doneStatus("DATA_STORE_RESET_COSTS", startedAt), value: null };
    }
  };
}

type D1EventRow = {
  id: string;
  type: DataStoreRecordType;
  scope?: string;
  payload_json?: string;
  created_at: string;
};

type D1CostRow = {
  id: string;
  provider: string;
  feature: string;
  amount_usd: number;
  units?: number;
  payload_json?: string;
  created_at: string;
};

function eventFromD1(row: D1EventRow): DataStoreRecord {
  return {
    id: row.id,
    type: row.type,
    scope: row.scope,
    payload: parseJson(row.payload_json),
    createdAt: row.created_at
  };
}

function costFromD1(row: D1CostRow): DataStoreCost {
  return {
    id: row.id,
    provider: row.provider,
    feature: row.feature,
    amountUsd: row.amount_usd,
    units: row.units,
    payload: parseJson(row.payload_json),
    createdAt: row.created_at
  };
}

function parseJson(value?: string) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function withoutPayload<T extends { payload?: unknown }>(value: T) {
  const { payload, ...rest } = value;
  void payload;
  return rest;
}

function log(logger: DataStoreLogger | undefined, level: "info" | "error", method: string, message: string, data?: unknown) {
  logger?.({ level, method, message, data, createdAt: new Date().toISOString() });
}

function doneStatus(method: string, startedAt: string): MethodStatus {
  return { method, ok: true, phase: "done", startedAt, finishedAt: new Date().toISOString() };
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
