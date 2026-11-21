# Spec: BTC/USDT Elliott Wave Dashboard

This spec is the source of truth for v1. Vocabulary follows [`GLOSSARY.md`](../GLOSSARY.md).
Decisions that deviate from the obvious path are recorded in [`adr/`](./adr/).

---

## 1. Overview

A personal, read-only dashboard for BTC/USDT on Binance. It:

1. Detects pivots with an adaptive ZigZag on six timeframes: 15m, 1h, 4h, 1d, 1w, 1M.
2. Builds Elliott wave counts that end at the latest pivot, scores them against Fibonacci ratios
   and promotes the best two to a **Primary Scenario** and an **Alternative Scenario**.
3. Projects the waves still to come.
4. Maps the scenario to a **Setup** and emits a 1x **Signal** (entry, stop loss, TP1, TP2, R:R,
   status), mirrored for both directions.
5. Commits the user's whole capital (1x) with the stop loss at the risk per trade from the entry
   (§7, [ADR 0003](adr/0003-stop-loss-at-risk-per-trade.md)).
6. Summarises the six timeframes into a **Confluence** reading.
7. Streams live data from Binance's public REST and WebSocket APIs, with no API key.

The user reads the signal and acts manually. The dashboard never places orders.

### 1.1 Out of scope (v1)

- Order execution (Binance private API, bots, webhooks).
- Signal history, persistence or backtesting.
- Alerts (Telegram, Discord, push, email).
- Symbols other than BTCUSDT.
- Machine-learning confidence models.

---

## 2. Stack

| Concern | Choice |
| :-- | :-- |
| Build / dev server | Vite, React, TypeScript `strict` (see [ADR 0001](./adr/0001-vite-spa-instead-of-nextjs.md)) |
| Runtime / package manager | Bun |
| Styling | Tailwind CSS with the palette in §9.1 |
| Chart | TradingView Lightweight Charts **v5**, exact version pinned in `package.json` |
| Icons | Lucide React |
| Tests | Vitest, run with `bun run test` |
| Hosting | Cloudflare Pages at `https://btc-elliott.allisson.dev`, deployed by a `v*` tag (see [`deployment.md`](./deployment.md)) |

All code, identifiers, comments, docs and UI strings are in English.

### 2.1 Layout

```
├── GLOSSARY.md
├── docs/
│   ├── spec.md           # this file
│   ├── roadmap.md
│   ├── deployment.md     # release workflow, headers, Cloudflare and GitHub setup
│   └── adr/
├── scripts/
│   └── record-snapshots.ts  # records the real Binance fixtures (§11)
├── src/
│   ├── main.tsx
│   ├── App.tsx            # orchestrator: data, analysis, UI state
│   ├── index.css
│   ├── types.ts
│   ├── config.ts          # every tunable constant (§4.6)
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── ConfluenceStrip.tsx
│   │   ├── ElliottChart.tsx
│   │   └── SignalPanel.tsx
│   └── lib/
│       ├── binance/
│       │   ├── rest.ts
│       │   └── stream.ts
│       ├── engine/        # pure functions, no DOM, no network
│       │   ├── zigzag.ts
│       │   ├── rules.ts
│       │   ├── counts.ts
│       │   ├── projections.ts
│       │   ├── scenarios.ts
│       │   ├── rsi.ts
│       │   ├── setups.ts
│       │   ├── risk.ts
│       │   ├── confluence.ts
│       │   ├── analysis.ts    # one timeframe at candle close (§6.5)
│       │   └── __fixtures__/
│       ├── live.ts        # pure reducer: REST loads and stream messages → live state (§3.3, §3.4)
│       ├── chart.ts       # pure mapping: scenario and signal → chart lines, markers, price lines (§9.4)
│       └── format.ts      # price, %, R:R and Copy Setup text
```

---

## 3. Data

### 3.1 Timeframes

| Id | UI label | Binance interval | Seconds | ZigZag threshold |
| :-- | :-- | :-- | --: | --: |
| `15m` | 15M | `15m` | 900 | 1.0% |
| `1h` | 1H | `1h` | 3,600 | 1.8% |
| `4h` | 4H | `4h` | 14,400 | 3.2% |
| `1d` | 1D | `1d` | 86,400 | 5.5% |
| `1w` | 1W | `1w` | 604,800 | 9.5% |
| `1M` | 1M | `1M` | calendar month | 17% |

The 15m and 1M thresholds extrapolate the ×1.75 step between the others; Phase 11 checked them on
the recorded snapshots (roadmap). `1M` is the month, never the minute.

**Candle step.** The candle `n` steps after a candle opening at `t` opens at `t + n × seconds` on
every timeframe but `1M`, where it opens at 00:00 UTC on the first day of the month `n` months
after `t`'s month (Binance opens monthly candles there). Every candle time derived in this spec
uses the candle step: projected times (§4.5), the close time of an analysed candle (§10) and the
chart's future time slots (§9.4).

### 3.2 REST (history)

- Base URL: `https://api.binance.com/api/v3`.
- `GET /klines?symbol=BTCUSDT&interval={interval}&limit=1000`, one call per timeframe, all six in
  parallel on load.
  - Parse: `[0] openTime` (ms → `/1000` = seconds UTC), `[1] open`, `[2] high`, `[3] low`,
    `[4] close`, `[5] volume`, all as `number`.
  - The last kline returned is still open: it is drawn on the chart but **excluded from analysis**.
- `GET /ticker/24hr?symbol=BTCUSDT` on load for the header stats.
- The stream (§3.3) opens **before** these calls, so no candle close falls between the REST
  response and the first stream message.

### 3.3 WebSocket (live)

- One combined connection:
  `wss://stream.binance.com:9443/stream?streams=btcusdt@kline_15m/btcusdt@kline_1h/btcusdt@kline_4h/btcusdt@kline_1d/btcusdt@kline_1w/btcusdt@kline_1M/btcusdt@ticker`
- Kline payload (`data.k`): `t` start time (ms), `o h l c v`, `x` closed flag, `i` interval.
  - `t === lastCandle.time`: replace the open candle.
  - `t > lastCandle.time`: append a new open candle.
  - `x === true`: the candle is closed. Move it into the analysed set and **recompute that
    timeframe's analysis** (§4–§7), then recompute confluence (§8). Until the next candle's first
    kline arrives, the timeframe has no open candle.
  - `t ≤` the last closed candle's time: ignored (already in the analysed set).
- While the REST load or a backfill is in flight, kline messages are buffered and applied, in
  order and by the rules above, on top of the REST history once it lands. Ticker messages are
  applied at once.
- Ticker payload (`data`): `c` last price, `p` change, `P` change %, `h` high, `l` low, `v` volume.
  Each ticker update refreshes the header and every price-dependent signal metric (§6.5) without
  recomputing counts.
- Reconnect: on close or error, retry every 3 s. After reconnecting, refetch the REST klines for
  all six timeframes (backfill), then re-analyse them. A failed backfill is retried every 3 s
  while the stream stays up.
- Drop detection: a cut network does not always close the socket. The stream is treated as dropped
  when no message has arrived for `STREAM_STALE_MS` (10 s; the ticker arrives about once a
  second), and at once when the browser fires `offline`.

### 3.4 Failure handling (no synthetic data)

Synthetic candles never exist at runtime ([ADR 0002](./adr/0002-no-synthetic-data-at-runtime.md)).

- **Initial REST failure** (network, HTTP 4xx/5xx, rate limit): full-screen error state with the
  first failing endpoint, the HTTP status if any, and a Retry button. No chart, no signals. Retry
  restarts the whole load: the stream and the seven REST calls.
- **WebSocket down** after a successful load: the header badge switches from `LIVE` to `OFFLINE`
  and shows the time of the last real update: the last stream message received, or the REST load
  if none arrived. The chart keeps the last real data. Every signal is hidden and replaced with
  "Signals paused: data stale since HH:mm UTC" until the stream is back and backfill completes;
  the badge stays `OFFLINE` until then too. Ticker messages that arrive meanwhile still update
  the header price.

---

## 4. Wave engine

Notation: `s = +1` for a bullish count and `s = −1` for a bearish one. `P0…P5` are the impulse
points and `PA, PB` the corrective ones. `len(Wn) = |Pn − Pn−1|`.

### 4.1 ZigZag pivots

Input: the closed candles of one timeframe and its threshold `θ` (§3.1).

1. Track the running high (with index) and running low (with index) from the first candle.
2. The initial direction is set by whichever comes first: a fall of `≥ θ` from the running high
   (the high becomes a **peak**) or a rise of `≥ θ` from the running low (the low becomes a
   **trough**).
3. From then on, track the extreme in the current direction. A **peak** is confirmed when a later
   candle's low is `≤ high × (1 − θ)`. A **trough** is confirmed when a later candle's high is
   `≥ low × (1 + θ)`. The confirming candle starts tracking the opposite extreme.
4. Pivots alternate peak/trough. The final, unconfirmed extreme is **not** a pivot.

Within one candle (the data has no intra-candle order):

- **Extend first, then confirm.** A candle that sets a new running extreme (strictly higher high or
  strictly lower low) only moves the extreme; it never confirms the extreme it just set. An
  outside candle that both makes a new high and falls `θ` below the old one therefore confirms
  nothing; a later candle confirms the new high.
- **Ties keep the first.** A high equal to the running high does not move it (same for lows).
- **Ambiguous start waits.** If, before the first pivot, one candle meets both the fall from the
  running high and the rise from the running low, neither is confirmed; the first candle that
  meets only one of them decides.

Comparisons use the formulas above as written, with no epsilon.

Output: `Pivot[]` with `index`, `time`, `price` (the candle's high for a peak, low for a trough)
and `type`.

### 4.2 Counts

A count is valid only if its **last point is the latest confirmed pivot**. The leg from that pivot
to the current price is the **wave in progress**.

Generation: for each anchor `i` among the last `K = 8` pivots, take the pivots `p[i]…p[last]`.
Their number `m` defines the shape. Any other `m` is not a count.

| m | Labels | Wave in progress (UI) |
| --: | :-- | :-- |
| 3 | (0)(1)(2) | Wave 3 in progress |
| 4 | (0)…(3) | Wave 4 forming |
| 5 | (0)…(4) | Wave 5 in progress |
| 6 | (0)…(5) | Correction A in progress |
| 7 | (0)…(5)(A) | Wave B in progress |
| 8 | (0)…(5)(A)(B) | Wave C in progress |

The anchor's type sets the direction: a trough gives a bullish count (`s = +1`) and a peak gives a
bearish one (`s = −1`). Each anchor yields at most one count, so there are at most 6 candidates per
timeframe.

### 4.3 Rules

A candidate is discarded if any applicable check fails.

| Check | Applies when | Condition |
| :-- | :-- | :-- |
| Rule 1: Wave 2 does not retrace past the start of Wave 1 | m ≥ 3 | `s·(P2 − P0) > 0` |
| Wave 3 goes beyond Wave 1 (structural) | m ≥ 4 | `s·(P3 − P1) > 0` |
| Rule 3: Wave 4 does not overlap Wave 1 | m ≥ 5 | `s·(P4 − P1) > 0` |
| Rule 2: Wave 3 is not the shortest | m ≥ 6 | `len(W3) ≥ min(len(W1), len(W5))` |
| Rule 2, pending | m = 4 or 5 and `len(W3) < len(W1)` | passes; Wave 5 projection capped at `len(W3)` (§4.5); checklist detail says "requires Wave 5 ≤ Wave 3" |
| Wave B does not pass the Wave 5 extreme (structural) | m = 8 | `s·(P5 − PB) > 0` |

The B check keeps counts consistent with §5.5: a count whose PB already passed P5 would be born
invalidated.

The checklist in the UI shows Rule 1, Rule 2 and Rule 3 as `VALID` / `VIOLATED`, each with its
formula and measured values. A rule that does not apply yet (e.g. Rule 3 when m = 3) shows
`NOT YET`. Rule 2 applies from m = 6, so at m = 4 and 5 it is always `NOT YET`; its detail is
"requires Wave 5 ≤ Wave 3" when pending, the formula otherwise. Structural checks have no
checklist entry.

Every count that survives generation has only `VALID` and `NOT YET` checks, since a violation
discards the candidate. `VIOLATED` appears only after a breach (§6.4) since the last candle close,
per scenario, whether or not it has a setup:

| Last point | Breach | Rule shown `VIOLATED` |
| :-- | :-- | :-- |
| (2) | invalidation price P0 | Rule 1 |
| (3), (4) | invalidation price P1 | Rule 3 (at (3) it goes from `NOT YET` to `VIOLATED`) |
| (4), Rule 2 pending | beyond `P4 + s·len(W3)` (Wave 5 already longer than Wave 3) | Rule 2 |
| (5), (A), (B) | invalidation price P5 | none: the impulse is not over, no rule broke |

The Rule 2 breach changes only the checklist: the scenario's invalidation price stays P1, and
past that level the price is already beyond TP2, so the signal is Watching.

Detail strings show prices and wave lengths with 2 decimals, e.g.
`s·(P2 − P0) > 0 · P2 98.00 vs P0 95.00`.

### 4.4 Ratios and scoring

Measured ratios, where they exist:

| Ratio | Formula | Fibonacci targets |
| :-- | :-- | :-- |
| W2 retracement | `len(W2) / len(W1)` | 0.5, 0.618, 0.786 |
| W3 extension | `len(W3) / len(W1)` | 1.618, 2.618 |
| W4 retracement | `len(W4) / len(W3)` | 0.382, 0.5 |
| W5 extension | `len(W5) / len(W1)` | 1.0 |
| A retracement | `|P5 − PA| / |P5 − P0|` | 0.382, 0.5 |
| B retracement | `|PB − PA| / |P5 − PA|` | 0.5, 0.618 |

- Grade of one ratio: `d = min |ratio − target|` over its targets (absolute, in ratio units),
  `grade = max(0, 1 − d / TOLERANCE)`, with `TOLERANCE = 0.15`.
- Candidate score: mean of its grades, in [0, 1].
- Known bias: a short count has fewer grades (m = 3 has only W2), so one ratio on target scores
  1.0 and can outrank a longer, well-formed count. Kept as is; to be reviewed against the real
  snapshots in Phase 6.

### 4.5 Projections

Projections run from the count's last point. `W1 = P1 − P0` (signed) and `A = PA − P5` (signed).

| Last point | Projected points |
| :-- | :-- |
| (2) | `P3' = P2 + 1.618·W1` (target range `P2 + [1.618, 2.618]·W1`); `P4' = P3' − 0.382·(P3' − P2)`; `P5' = P4' + 1.0·W1` |
| (3) | `P4' = P3 − 0.382·(P3 − P2)`; `P5' = P4' + 1.0·W1` |
| (4) | `P5' = P4 + 1.0·W1` |
| (5) | `PA' = P5 − 0.382·(P5 − P0)` (range 0.382–0.5); `PB' = PA' + 0.5·(P5 − PA')`; `PC' = PB' − 1.0·(P5 − PA')` (range 1.0–1.618) |
| (A) | `PB' = PA + 0.5·(P5 − PA)`; `PC' = PB' + 1.0·A` (range `PB' + [1.0, 1.618]·A`) |
| (B) | `PC' = PB + 1.0·A` (range `PB + [1.0, 1.618]·A`) |

When Rule 2 is pending (§4.3), `|P5' − P4|` is capped at `len(W3)`, using `P4'` when P4 is
projected (last point (3)).

Projected times: the mean leg duration of the confirmed count is
`(lastPoint.index − firstPoint.index) / (m − 1)` candles, rounded, and at least 1. The first
projected leg lasts `max(mean, elapsed + 1)` candles, where `elapsed` is the number of closed
candles since the last point (`lastClosedIndex − lastPoint.index`), so it never lands on a candle
already past; each later leg lasts the mean. A point `n` candles after the last point has the
time `n` candle steps after `lastPoint.time` (§3.1).

### 4.6 Tunables

`src/config.ts` holds every constant: thresholds (§3.1), `K = 8`, `TOLERANCE = 0.15`, the Fibonacci
targets and ranges, setup trigger ranges (§6.2), `RSI_PERIOD = 14`,
`MIN_RR1 = 1`, `MIN_SIGNAL_CONFIDENCE = 0.5`, the 3 s reconnect delay, and the risk defaults and limits (§7).

---

## 5. Scenarios

Per timeframe:

1. Score every valid candidate (§4.4).
2. **Primary Scenario** = highest score. **Alternative Scenario** = second highest. Every
   candidate ends at a different label, so the two always differ in structure. On equal scores
   the count with more points (larger m) ranks first.
3. Confidence:
   - Both exist and `pP + pA > 0`: Primary = `pP / (pP + pA) × 100`, Alternative = `100 − Primary`.
   - Both exist and `pP + pA = 0`: 50 / 50.
   - Only one exists: Primary = `pP × 100`; the Alternative is shown as "unavailable".
   - None exists: the timeframe is **Neutral**. No scenario, no signal, and no confluence vote.
4. **Scenario direction** = the direction of the wave in progress, i.e. the next expected move:

   | Last point | Direction |
   | :-- | :-- |
   | (2), (4), (A) | `s` (with the impulse) |
   | (3), (5), (B) | `−s` (against the impulse) |

5. **Invalidation price** and reason:

   | Last point | Invalidation | Reason |
   | :-- | :-- | :-- |
   | (2) | P0 | Wave 2 would retrace past the start of Wave 1 (Rule 1) |
   | (3), (4) | P1 | Wave 4 would overlap Wave 1 (Rule 3) |
   | (5), (A), (B) | P5 | Price beyond the Wave 5 extreme: the impulse is not over |

   Breach means `s·(price − invalidation) ≤ 0` for the first two rows and
   `s·(price − P5) > 0` for the last.

6. Each scenario carries a **thesis**: a template sentence built from its last point, impulse
   direction, measured ratio, next projected point and invalidation. Written for a bullish
   impulse; a bearish one says `Bearish` and swaps `below ↔ above`:

   | Last point | Thesis |
   | :-- | :-- |
   | (2) | `Bullish impulse; Wave 2 retraced <w2> of Wave 1; Wave 3 in progress toward 1.618 at <P3'>; invalid below <P0>.` |
   | (3) | `Bullish impulse; Wave 3 extended <w3> of Wave 1; Wave 4 forming toward 0.382 at <P4'>; invalid below <P1>.` |
   | (4) | `Bullish impulse; Wave 4 retraced <w4> of Wave 3; Wave 5 in progress toward 1.0 at <P5'>; invalid below <P1>.` |
   | (5) | `Bullish impulse complete; Wave 5 extended <w5> of Wave 1; Correction A in progress toward 0.382 at <PA'>; invalid above <P5>.` |
   | (A) | `Bullish impulse complete; Wave A retraced <a> of the impulse; Wave B in progress toward 0.5 at <PB'>; invalid above <P5>.` |
   | (B) | `Bullish impulse complete; Wave B retraced <b> of Wave A; Wave C in progress toward 1.0 at <PC'>; invalid above <P5>.` |

   Ratios and prices use 2 decimals; the Fibonacci targets are the §4.5 projection constants.
   When Rule 2 is pending at (4), the Wave 5 clause reads `Wave 5 in progress toward <P5'>
   (capped at Wave 3 length)`. At (3) the thesis names only P4', so it is unchanged.

---

## 6. Setups and signals

### 6.1 RSI divergence

Wilder RSI over closes with period 14. For a count ending at (5), divergence exists when
`s·(P5 − P3) > 0` and `s·(RSI[P5.index] − RSI[P3.index]) < 0`. If RSI is undefined at `P3.index`
(fewer than 15 candles up to and including it), there is no divergence.

The first RSI value is at index 14, seeded with the simple mean of the first 14 gains and losses,
then Wilder smoothing. When the average loss is 0, RSI is 100; when both averages are 0, RSI is 50.

### 6.2 Setups

The scenario's last point picks the setup. Its trigger decides between Active and Watching (§6.4).
Formulas are written for `s = +1`. For `s = −1`, mirror the direction. The setup fixes the targets;
the stop loss is not a setup level: it sits at the risk per trade from the entry (§6.3, §7).

| Setup | Last point | Trigger | Direction | TP1 | TP2 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1: Wave 2→3 | (2) | W2 retracement ∈ [0.382, 0.886] | LONG | `P1` | `P3'` (1.618) |
| 2: Wave 4→5 | (4) | W4 retracement ∈ [0.236, 0.5] and Rule 3 holds | LONG | `P3` | `P5'` |
| 3a: Wave 5 exhaustion | (5) | RSI divergence (§6.1) | SHORT | `P4` | `PA'` |
| 3b: Wave B→C | (B) | B retracement ∈ [0.45, 0.668] (0.5–0.618 ± 0.05) | SHORT | `PA` | `PB + 1.618·A` |

- Any setup: if TP2 is not beyond TP1 in the trade's direction, swap them so that TP1 is always
  the nearer target. In practice this happens in Setup 3a (`PA'` not beyond `P4`) and Setup 2
  (`P5'` short of `P3` when `len(W1) < len(W4)`, or when the Rule 2 cap applies); Setups 1 and 3b
  cannot invert.
- Setup 2: "Rule 3 holds" is always true for a surviving count (§4.3), so the trigger measures only
  the W4 retracement. A live Rule 3 breach is an invalidation (§6.4).
- Setup 2 uses the scenario's `P5'`, capped when Rule 2 is pending (§4.5).
- Last point (3) or (A): no setup applies. The scenario is shown with no levels and the wave whose
  completion unlocks the next setup: "No setup: waiting for Wave 4 to complete (then Setup 2)"
  for (3), "No setup: waiting for Wave B to complete (then Setup 3b)" for (A).

### 6.3 Price metrics

`entry` = current price (live ticker).

```
t        = +1 for LONG, −1 for SHORT
risk     = entry × risk% / 100          # risk per trade (§7)
SL       = entry − t·risk
rr1      = t·(TP1 − entry) / risk
rr2      = t·(TP2 − entry) / risk
Δ%(x)    = (x − entry) / entry × 100
```

The stop loss moves with the entry: it is where to put the stop when entering now, so hitting it
loses exactly the risk per trade (§7). R:R is the distance to the target in units of the risk per
trade. R:R is signed: it is `≤ 0` once the price has reached or passed the target. Such a target is
**passed**: it holds no reward left and the UI drops it (§6.4, §9.4–§9.6).

### 6.4 Status

Evaluated on every ticker update for a scenario that has a setup:

- **INVALIDATED**: since the last candle close, the live price has breached the scenario's
  invalidation price. It stays Invalidated until the next close re-analyses the timeframe. The
  stop loss moves with the entry (§6.3), so it is never breached and never invalidates.

A **breach** since the last close is checked against the live price and the extremes of that
timeframe's open candle (its high and low cover every trade since the close, including those before
a reload). Between a close and the next candle's first kline there is no open candle, and only the
live price is checked. The invalidation price uses the §5.5 conditions.
- **ACTIVE**: not invalidated, trigger met, and `rr ≥ 1` towards the
  **target**: TP1 while it is ahead, TP2 once TP1 is passed (§6.3).
- **WATCHING**: any other case, e.g. trigger not met or `rr < 1` towards the target.

Past both targets the signal is spent: unless Invalidated, the scenario is shown as having no
setup, with "No setup: both targets passed" (§9.3, §9.5).

A scenario with a setup whose confidence is below `MIN_SIGNAL_CONFIDENCE = 0.5`, i.e. shown as
`0%`, has no signal: its count, thesis and invalidation stay, and it is shown as having no setup,
with "No setup: 0% confidence" (§9.3, §9.5).

An Invalidated signal is dead: the count it trades no longer holds, so the metrics derived from
`entry` (stop loss, Δ%, R:R, position size, risk) are not shown. The targets stay visible for
reference (§9.5) and Copy Setup is disabled (§9.6). A Watching signal
keeps its R:R visible: it explains why entry is not worth it.

### 6.5 What updates when

| Event | Recomputed |
| :-- | :-- |
| Kline closed (`x = true`) | pivots, counts, scenarios, setup, status, confluence for that timeframe |
| Ticker update | entry, stop loss, Δ%, R:R, status, position size for every timeframe |
| Open-candle kline update | chart candle only |

---

## 7. Position sizing

Inputs in the Signal Panel, shared by every timeframe and scenario and stored in `localStorage`
(a local preference, not signal history):

| Input | Default | Valid range | Empty or invalid |
| :-- | --: | :-- | :-- |
| Capital (USDT) | 1000 | > 0 | default |
| Risk per trade (%) | 1 | 0.1 – 10, inclusive | default |

An out-of-range value falls back to the default; it is not clamped (risk 15 becomes 1, not 10).

The position is always the whole capital (1x), and the risk per trade sets the stop loss: it sits
`risk%` from the entry (§6.3), so hitting it loses `risk%` of the position
([ADR 0003](adr/0003-stop-loss-at-risk-per-trade.md)):

```
position_usd   = capital
position_btc   = capital / entry
risk_usd       = capital × risk% / 100
```

With the defaults, 1000 USDT with a stop 1% away: hitting it loses 10 USDT. The stop no longer
marks the count's structure; the scenario's invalidation price does (§5.5, §9.4).

---

## 8. Confluence

- Each non-Neutral timeframe votes with its **Primary Scenario's** direction (§5.4). The
  Alternative toggle never changes votes.
- `agree` = the size of the largest direction group, out of 6. Neutral timeframes still count in
  the 6.
- Labels:
  - 6/6: **Strong Confluence** (bullish or bearish).
  - 5/6 or 4/6: **Mixed Market**, majority direction shown.
  - 3/6: **Mixed Market**, majority direction shown, or "split" on a 3–3 tie.
  - 2/6 or fewer: **No Confluence**; `majority` is `null`, including on a 2–2 or 1–1 tie.
- Strong means `agree` equals the number of timeframes; the Mixed floor is
  `CONFLUENCE_MIN_MIXED` (3) in `config.ts`.
- Votes are cast at candle close (§6.5): a Primary Scenario breached by the ticker keeps its vote
  until its timeframe's next close.
- Engine entry point: `confluence(analyses: Record<Timeframe, TimeframeAnalysis>): Confluence`.

---

## 9. UI

### 9.0 Layout ("Terminal")

Chosen in Phase 0 from three prototypes. Visual reference: `git show dacedf1:prototypes/a/`
(mock data, deleted afterwards).

Desktop (`lg`, ≥ 1024 px): one screen, no page scroll.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header (§9.2): BTC/USDT · price · 24h  15M 1H 4H 1D 1W 1M · toggles · LIVE   │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│Confluence│ 15M card │ 1H card  │ 4H card  │ 1D card  │ 1W card  │ 1M card    │
│badge (§8)│          │          │          │          │          │            │
├──────────┴──────────┴──────────┴──────────┴─────┬────┴──────────┴────────────┤
│ Chart context bar: BTC/USDT · TF · scenario ·   │ Signal panel (§9.5)         │
│ wave in progress · line legend                  │ 380 px (400 px at xl),      │
├─────────────────────────────────────────────────┤ scrolls on its own          │
│ Elliott chart (§9.4), fills the remaining space │                             │
│                                                 │                             │
└─────────────────────────────────────────────────┴────────────────────────────┘
```

- The focused timeframe's card has an accent border; the header buttons and the cards both
  change focus. On load the focus is `4H` (`DEFAULT_TIMEFRAME` in `config.ts`), the `Projections`
  and `Trade 1x` toggles are on, and every timeframe's scenario tab is Primary. None of these is
  persisted (§1.1); only the risk inputs are (§7).
- Below `lg` everything stacks in one scrolling column: header (wraps), confluence strip (cards
  scroll horizontally), chart at a fixed 420 px, then the signal panel. No horizontal page
  scroll at 390 px.
- Neutral timeframe: the chart shows candles only, with an overlay "<TF> is Neutral: no valid
  count to draw."
- Offline (§3.4): the cards show `PAUSED` instead of a status, the chart drops its price lines and
  shows "Signals paused: data stale since HH:mm UTC", and the signal panel replaces the signal
  card with the same notice.

### 9.1 Palette

| Token | Hex |
| :-- | :-- |
| background | `#0b0e14` |
| surface / surface-2 | `#121824` / `#182234` |
| border | `#233047` |
| bullish | `#00c087` |
| bearish | `#f6465d` |
| confirmed wave | `#38bdf8` |
| projected wave | `#f59e0b` |
| accent | `#f0b90b` |

The page declares `color-scheme: dark`, so native scrollbars and form controls are dark too.

### 9.2 Header

- Left: Bitcoin icon, `BTC/USDT`, `Binance Spot` badge, live price that flashes green or red on
  change, 24h change in USDT and %, 24h high and low. The change is signed and coloured bullish or
  bearish, e.g. `-2,265.46 (-3.56%)`; high and low read `H 64,080.00` and `L 61,230.00`. The 24h
  volume is not shown.
- Right: timeframe buttons `15M 1H 4H 1D 1W 1M`; `Projections` toggle (projected line and future
  markers); `Trade 1x` toggle (signal price lines); connection badge (`LIVE` with a pulsing green
  dot, or `OFFLINE · last update HH:mm UTC`).

### 9.3 Confluence strip

Six cards below the header, one per timeframe in ascending order and in one row, showing the
label, direction badge, wave in progress, signal status (or `NO SETUP` / `NEUTRAL`) and Primary
confidence. Clicking a card
focuses that timeframe. A confluence badge (§8) sits at the strip's start.

A card always shows its timeframe's **Primary Scenario**, like the confluence vote (§8); the
scenario tabs (§9.5) change the chart and the panel, never the card. The status is the Primary
signal's (§6.4); `NO SETUP` when the Primary Scenario has none or its signal is spent, `NEUTRAL` on a Neutral timeframe,
and `PAUSED` while signals are paused (§9.0).

### 9.4 Elliott chart

- Draws one scenario at a time: the one selected in the scenario tabs (§9.5).
- Candlestick series and a volume histogram on its own scale at 18% opacity, each bar bullish
  `#00c087` when close ≥ open and bearish `#f6465d` otherwise, in the bottom of the pane
  (height fraction in `config.ts`).
- Confirmed wave line: solid `#38bdf8` through the count's points, with markers `(0)…(5)`,
  `(A)`, `(B)`.
- Projected wave line: dashed `#f59e0b` from the last point through the projected points, with
  markers. Hidden when `Projections` is off; its points stay on the time scale while hidden, so
  toggling it never moves the visible range. Target ranges (`targetRange`) are not drawn in v1.
- Markers sit above the candle at peaks and below it at troughs, in the line's colour (blue
  confirmed, amber projected), with the same text for both: `(3)`, never `(3')`.
- When a candle close re-analyses the timeframe, lines and markers are replaced whole; the
  visible range stays.
- Price lines, hidden when `Trade 1x` is off, the scenario has no setup, the signal is
  Invalidated (§6.4) or signals are paused (§3.4): `ENTRY 1x` (solid
  blue), `STOP LOSS` (dashed red), `INVALIDATION` (dashed purple, the scenario's invalidation
  price), `TP1 [R:R 1:x.x]` (dashed green), `TP2 [R:R 1:x.x]` (dotted dark green); a passed target (§6.3) has no line and no legend entry. They are created once and updated in place on each ticker (`ENTRY 1x` moves with
  the price and `STOP LOSS` with it, the R:R in the TP titles changes), never recreated per tick. Their prices are part of
  the price scale's autoscale, so no visible level falls off the pane. `ENTRY 1x` blue is
  `#3b82f6`, `INVALIDATION` purple `#a855f7` and TP2 dark green `#0f7a5a` (`CHART_COLORS` in
  `config.ts`).
- The candlestick series' own last-price line is hidden while `ENTRY 1x` is visible (same price)
  and shown otherwise.
- Resizes with its container (`autoSize`).
- Initial visible range: from the count's (0) to its last projected point, with a margin; on a
  Neutral timeframe, the last N candles (N in `config.ts`). It is recomputed when the focused
  timeframe or the selected scenario changes, never on a candle or ticker update, so the user's
  zoom and scroll survive live data.
- Owns the chart context bar, the Neutral overlay and the paused overlay (§9.0).
- Context bar text, segments joined by ` · `, confidence without decimals:
  `BTC/USDT · 4H · Primary Scenario (83%) · Wave 3 in progress` (the last segment is the
  scenario's wave in progress, §4.2); on a Neutral timeframe, `BTC/USDT · 1W · Neutral`.
- Line legend at the end of the context bar: a swatch and name for each line currently drawn,
  and only those: `Confirmed`, `Projected`, `Entry`, `Stop`, `Invalidation`, `TP1`, `TP2`. While paused the bar
  is unchanged except that the trade entries drop out with their lines; the stale notice lives
  only in the overlay.

### 9.5 Signal panel

Sections top to bottom, in this order:

- Scenario tabs: **Primary Scenario** / **Alternative Scenario** with confidence. They switch the
  chart and panel for the focused timeframe only: each timeframe keeps its own selection, so
  leaving 4H on Alternative and coming back finds it on Alternative. When there is no
  Alternative Scenario (§5), its tab is disabled and reads `Alternative Scenario · unavailable`;
  if a re-analysis removes the Alternative while it is selected, the selection returns to Primary.
- Signal card: direction badge (`LONG 1x` / `SHORT 1x`), setup name, status, "1x, no leverage"
  notice, **Copy Setup** button. Metric grid: Entry, Stop Loss (Δ%), TP1 (Δ%, R:R), TP2 (Δ%, R:R), each dropped once passed (§6.3),
  Position (USDT and BTC), Risk (USDT and % of capital). A red box states the invalidation
  condition. When Invalidated (§6.4): TP1 and TP2 show their prices only, without Δ% or R:R;
  Entry, Stop Loss, Position and Risk show `—`; Copy Setup is disabled; the red box stays.
  Copy Setup writes the §9.6 text to the clipboard; the button then reads `Copied` (or
  `Copy failed` when the clipboard refuses) for `COPY_FEEDBACK_MS` in `config.ts`. `Generated` is
  the time of the click.
  - Scenario with no setup (last point (3) or (A), §6.2), a spent signal or a 0% confidence
    scenario (§6.4): the card shows
    the "No setup: …" text instead of the badge, metrics and Copy Setup; the red box stays.
  - Neutral timeframe: both tabs are disabled and the card reads "<TF> is Neutral: no valid
    count"; the checklist and the Fibonacci box are hidden; the risk inputs and the footer stay.
- Risk inputs: Capital (USDT), Risk per trade (%) (§7). Each field keeps the text as typed, and
  `localStorage` stores that text. The value in use is the text parsed and passed through the §7
  fallback, on input and on load. While the text is empty or invalid, the field shows
  "invalid, using default <value>" below it; the typed text is never overwritten.
- Rules checklist: Rule 1, 2, 3 with `VALID` / `VIOLATED` / `NOT YET`, formula and measured
  values. Statuses follow the live breach check (§4.3, §6.4).
- Fibonacci box: one line per measured ratio, in the order W2, W3, W4, W5, A, B, with 3 decimals:
  retracements as "Wave 2: 0.618 retracement", extensions with `×` as "Wave 3: 1.618× extension",
  corrective waves as "Wave A: 0.382 retracement" and "Wave B: 0.500 retracement". The thesis
  follows the ratios.
- Footer disclaimer: "Not financial advice."

### 9.6 Copy Setup

Not available for an Invalidated signal (§6.4). Plain text, no markdown. Prices with 2 decimals, Δ% signed with 2 decimals, R:R with 1 decimal,
BTC with 5 decimals, USDT amounts with 2 decimals. Numbers have no thousands separator
(`97234.50`), so they paste into an order form; the UI groups them (`97,234.50`). Signs use the
ASCII `+` and `-`. `<invalidation text>` is the scenario's invalidation reason (§5.5), verbatim.
`<conf>` has no decimals (`62%`); `<r>`, the risk per trade, has 2 (`1.00%`).

```
BTC/USDT · 4H · LONG 1x · Setup 1 (Wave 2→3)
Status: ACTIVE · Primary Scenario (<conf>%)
Entry:       <price>
Stop Loss:   <price>  (<Δ%>)
TP1:         <price>  (<Δ%>)  R:R 1:<x.x>
TP2:         <price>  (<Δ%>)  R:R 1:<x.x>
Position:    <usd> USDT (<btc> BTC) of <capital> USDT
Risk:        <usd> USDT (<r>% of capital)
Invalidation: <invalidation text> at <price>
Generated: <YYYY-MM-DD HH:mm UTC>
Not financial advice. 1x, no leverage.
```

A passed target (§6.3) has no line.

---

## 10. Types

```ts
export type Timeframe = '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
export type Direction = 'bullish' | 'bearish';
export type WaveLabel = '0' | '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'C';

export interface Candle {
  time: number; // seconds UTC, candle open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Pivot {
  index: number;
  time: number;
  price: number;
  type: 'peak' | 'trough';
}

export interface WavePoint {
  label: WaveLabel;
  time: number;
  price: number;
  index: number | null; // null for projected points
  projected: boolean;
  targetRange?: { min: number; max: number };
}

export type RuleId = 'rule1' | 'rule2' | 'rule3';
export interface RuleCheck {
  rule: RuleId;
  status: 'valid' | 'violated' | 'not_yet';
  detail: string;
}

export interface FibRatios {
  w2Retracement?: number;
  w3Extension?: number;
  w4Retracement?: number;
  w5Extension?: number;
  aRetracement?: number;
  bRetracement?: number;
}

export interface Count {
  impulseDirection: Direction; // s
  points: WavePoint[];         // confirmed only
  lastLabel: WaveLabel;
  ratios: FibRatios;
  rules: RuleCheck[];
  score: number;               // 0..1
}

export interface Scenario {
  rank: 'primary' | 'alternative';
  count: Count;
  direction: Direction;        // direction of the wave in progress (§5.4)
  waveInProgress: string;      // UI label (§4.2)
  projected: WavePoint[];
  confidence: number;          // 0..100
  invalidationPrice: number;
  invalidationReason: string;
  thesis: string;
}

export type SetupId = 'setup1' | 'setup2' | 'setup3a' | 'setup3b';

export interface SignalLevels {   // fixed at candle close
  setup: SetupId;
  side: 'LONG' | 'SHORT';
  triggerMet: boolean;
  takeProfit1: number;
  takeProfit2: number;
}

export interface Signal extends SignalLevels {  // recomputed on every ticker update
  timeframe: Timeframe;
  entry: number;
  stopLoss: number;            // entry ∓ risk per trade (§7): it moves with the entry
  rr1: number;
  rr2: number;
  status: 'ACTIVE' | 'WATCHING' | 'INVALIDATED';
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  analysedAt: number;          // close time of the last analysed candle: one candle step after its open (§3.1)
  primary: Scenario | null;    // null = Neutral
  alternative: Scenario | null;
  primaryLevels: SignalLevels | null;
  alternativeLevels: SignalLevels | null;
}

export interface RiskSettings {
  capital: number;
  riskPercent: number;
}

export interface PositionSize {
  positionUsd: number;
  positionBtc: number;
  riskUsd: number;
  riskPercent: number;
}

export interface Confluence {
  agree: number;               // 0..6
  majority: Direction | 'split' | null;
  label: 'strong' | 'mixed' | 'none';
}

export interface Ticker {
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}
```

---

## 11. Testing

- Vitest, `bun run test`. Engine modules (`src/lib/engine/*`) and `format.ts` are pure and fully
  unit-tested. Components get no unit tests; they are checked in the browser.
- Fixtures in `src/lib/engine/__fixtures__/`:
  - **Hand-built pivot and candle sequences**: one per rule (pass and violate), per count length
    (m = 3…8), per setup (trigger met and not met), each in both directions.
  - **One real kline snapshot** per timeframe, recorded from Binance as JSON and used as a
    regression test (pivot count, primary label, signal levels).
  - **Raw Binance payloads** (klines, 24h ticker, stream kline and ticker messages) in
    `__fixtures__/binance/`, recorded by `bun scripts/record-snapshots.ts`; the REST and stream
    parsers are tested against them.
- Done means: `bun run test` green, `bun run build` clean, `tsc --noEmit` clean.
