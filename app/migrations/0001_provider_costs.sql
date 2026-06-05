create table if not exists provider_costs (
  provider_id text primary key,
  turns integer not null default 0,
  estimated_cost real not null default 0,
  stt_cost real not null default 0,
  correction_cost real not null default 0,
  tts_cost real not null default 0,
  updated_at text not null default (datetime('now'))
);
