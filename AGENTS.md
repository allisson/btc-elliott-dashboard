# AGENTS.md

A personal, read-only BTC/USDT dashboard: Elliott wave counts on 15m/1h/4h/1d/1w/1M, Primary and
Alternative scenarios, 1x signals with position sizing, and multi-timeframe confluence. Live data
comes from Binance's public REST and WebSocket APIs. It never places orders.

## Read first

- [`docs/spec.md`](docs/spec.md): source of truth for behaviour, formulas and types. When code and
  spec disagree, the spec wins. When the spec is silent or wrong, stop and ask; do not guess.
- [`docs/roadmap.md`](docs/roadmap.md): phases in order, each with a "done when" check. Work one
  phase at a time.
- [`GLOSSARY.md`](GLOSSARY.md): canonical domain terms (Pivot, Count, Scenario, Setup, Signal,
  Confluence…). Use them in code, comments, tests and UI; avoid the listed synonyms.
- [`docs/adr/`](docs/adr/): deliberate deviations. Do not "fix" them back.

## Language

Everything is in English: code, identifiers, comments, docs, commit messages, UI strings.

## Stack

Vite + React + TypeScript (`strict`), Tailwind, Lucide, Lightweight Charts v5 (exact version
pinned), Vitest, Bun.

## Commands

```bash
bun install
bun dev              # local dev server
bun run test         # Vitest (not `bun test`, which is Bun's own runner)
bun run build
bunx tsc --noEmit
```

A phase is done only when `bun run test` is green, `bun run build` and `tsc --noEmit` are clean,
and the phase's "done when" check holds.

## Rules

- `src/lib/engine/` is pure: no DOM, no network, no `Date.now()`. Every function takes its inputs
  and returns data. All engine code is unit-tested with fixtures in `src/lib/engine/__fixtures__/`;
  write the test first.
- Every tunable constant (thresholds, `K`, tolerance, Fibonacci targets, trigger ranges, SL
  multipliers, RSI period, risk defaults) lives in `src/config.ts`. No magic numbers elsewhere.
- No synthetic market data at runtime ([ADR 0002](docs/adr/0002-no-synthetic-data-at-runtime.md)).
  On failure, show the error or offline state and hide signals. Synthetic candles exist only in
  tests.
- Counts, scenarios and setups are recomputed only on candle close. Ticker updates refresh only
  price-dependent metrics (entry, Δ%, R:R, status, position size). See spec §6.5.
- Every setup is mirrored for both directions. A change to one side needs the mirrored test.
- The position is always the whole capital (1x). The risk per trade sets the stop loss, `risk%`
  from the entry, so hitting it loses `risk%` of the capital (spec §7,
  [ADR 0003](docs/adr/0003-stop-loss-at-risk-per-trade.md)).
- Components are checked in the browser, not unit-tested. Describe what you verified there.
- Out of scope for v1 (spec §1.1): execution, persistence, backtesting, alerts, other symbols, ML.
  Do not add them.
