# Roadmap

Phases run in order; each ends with its "done when" check plus `bun run test` green,
`bun run build` clean and `tsc --noEmit` clean. Section numbers refer to [`spec.md`](./spec.md).

## Phase 0: Scaffold

- `bun create vite` (React + TS), TS `strict`, Tailwind with the §9.1 palette, Lucide, Vitest,
  Lightweight Charts v5 pinned to an exact version.
- `src/types.ts` (§10) and `src/config.ts` (§4.6).
- Layout from §2.1, with empty components rendering placeholders.

**Done when** `bun dev` serves a dark page with the four placeholder regions and
`bun run test` runs one passing smoke test.

## Phase 1: ZigZag

- `engine/zigzag.ts` (§4.1).
- Fixtures: hand-built candles where peaks and troughs are known; a sequence that never reaches the
  threshold; a threshold hit inside one candle.

**Done when** the tests prove alternation, confirmation at exactly `θ`, and that the last extreme
is never emitted.

## Phase 2: Counts and rules

- `engine/counts.ts`: candidate generation from the last `K` pivots, m = 3…8 (§4.2).
- `engine/rules.ts`: Rule 1, structural W3 > W1, Rule 3, Rule 2 and Rule 2 pending (§4.3).
- Ratios and scoring (§4.4).

**Done when** there is one fixture per rule (pass and violate) and per m in both directions, and
the scoring tests match grades computed by hand.

## Phase 3: Projections and scenarios

- `engine/projections.ts` (§4.5), including the Rule 2 cap and projected times.
- `engine/scenarios.ts`: Primary/Alternative ranking, confidence (all four cases), Neutral,
  scenario direction, invalidation and thesis (§5).

**Done when** the tests cover each last-point row of §4.5 and §5.4/§5.5 in both directions, plus
the 50/50, single-scenario and Neutral cases.

## Phase 4: Setups, signals and position size

- `engine/rsi.ts` (Wilder, 14) and divergence (§6.1).
- `engine/setups.ts`: the four setups mirrored, the 3a TP swap and "no setup" for (3)/(A) (§6.2);
  price metrics (§6.3); status (§6.4).
- `engine/risk.ts`: position sizing with the capital cap (§7).
- `format.ts`: number formatting and Copy Setup text (§9.6).

**Done when** each setup has fixtures (trigger met and not met, both sides); the status tests
cover Active, Watching (trigger, past TP1, `rr1 < 1`) and Invalidated; the risk tests cover normal
and capped; and Copy Setup output matches a golden string.

## Phase 5: Confluence

- `engine/confluence.ts` (§8).

**Done when** the tests cover 4/4 in both directions, 3/4, 2–2 split, 2/4 with Neutral, and 1/4.

## Phase 6: Binance client

- `binance/rest.ts`: klines (`limit=1000`, open kline flagged) and 24h ticker (§3.2).
- `binance/stream.ts`: combined stream, kline and ticker parsing, 3 s reconnect, backfill hook
  (§3.3).
- Record the real kline snapshots (one per timeframe) into `__fixtures__/` and add the regression
  test (§11).
- **Measure** how many pivots `limit=1000` yields per timeframe at the §3.1 thresholds. If the 1w
  gives fewer than `K + 1` pivots, record the number and raise it before Phase 7.

**Done when** the parsers are tested against recorded payloads, the snapshot regression test
passes, and the pivot counts are written in this file.

## Phase 7: Chart

- `ElliottChart.tsx`: candles, volume, confirmed and projected wave lines with markers, signal
  price lines, `Projections` and `Trade 1x` toggles, `autoSize` (§9.4).

**Done when**, in the browser, the 4H snapshot shows the confirmed count, a dashed projection into
the future, and the four price lines; the toggles hide and show them.

## Phase 8: Panels

- `Header.tsx` (§9.2), `ConfluenceStrip.tsx` (§9.3), `SignalPanel.tsx` (§9.5) with risk inputs in
  `localStorage`, the scenario tabs, the checklist, the Fibonacci box and Copy Setup.

**Done when**, in the browser, switching timeframe and scenario updates the chart and panel; Copy
Setup pastes the §9.6 text; and the risk inputs survive a reload and fall back to defaults when
invalid.

## Phase 9: Live integration

- `App.tsx`: parallel load of 4 timeframes, combined stream, analysis on close, ticker-driven
  metrics (§6.5), error state and offline mode (§3.4).

**Done when**, in the browser against live Binance: the price ticks; a 1h candle close re-analyses
only 1h; cutting the network shows `OFFLINE` and hides signals; restoring it backfills and
resumes.

## Phase 10 (optional): Static deploy

- Publish `dist/` to a static host.

**Done when** the deployed URL loads live data with no console errors.
