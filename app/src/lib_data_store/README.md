# lib_data_store

- role: one storage door
- use for: debug events, errors, costs, payments, history
- implementations:
  - `local-memory`
  - `cloudflare-d1`
- rule: app/server code should not touch payment/debug/cost tables directly
- every method returns `status`
- caller evaluates `status`
- caller writes debug item

## status

- `method`
- `ok`
- `phase`
- `startedAt`
- `finishedAt`
- `error`

## Methods

- `DATA_STORE_SAVE_EVENT`
  - input: `{ type, scope, payload }`
  - output: saved record
  - note: stores debug/error/history/payment-like event

- `DATA_STORE_LIST_EVENTS`
  - input: optional `{ type, limit }`
  - output: record array
  - note: debug page can display this directly

- `DATA_STORE_CLEAR_EVENTS`
  - input: optional `{ type }`
  - output: none
  - note: clears event records

- `DATA_STORE_SAVE_COST`
  - input: `{ provider, feature, amountUsd, units, payload }`
  - output: saved cost record
  - note: stores payment/cost usage

- `DATA_STORE_LIST_COSTS`
  - input: optional `{ provider, limit }`
  - output: cost array
  - note: reads cost/payment usage

- `DATA_STORE_RESET_COSTS`
  - input: optional `{ provider }`
  - output: none
  - note: clears cost/payment usage

## Cloudflare D1 tables

- `voice_trainer_events`
- `voice_trainer_costs`
