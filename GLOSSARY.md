# BTC Elliott Dashboard

A personal read-only dashboard for the BTC/USDT pair that counts Elliott waves across six
timeframes and turns that reading into unleveraged trade signals.

## Market data

**Closed candle**:
A candle whose interval has ended; only closed candles are analysed.
_Avoid_: kline (outside the raw Binance payload), bar, final candle

**Open candle**:
The latest candle of a timeframe, still forming; it is drawn but never analysed.
_Avoid_: kline (outside the raw Binance payload), live candle, current candle

**Backfill**:
Refetching every timeframe's history after the live stream reconnects, so no closed candle is
missed while it was down.
_Avoid_: resync, reload, catch-up

**Paused**:
The state, while the live stream is down or backfill has not finished, in which every signal is
hidden because the data is stale.
_Avoid_: stale mode, frozen, disconnected

## Wave structure

**Pivot**:
A peak or trough confirmed by the ZigZag, i.e. followed by a counter-move larger than the
timeframe's threshold.
_Avoid_: swing, extreme, vertex

**Peak / Trough**:
The two kinds of pivot: a peak is a confirmed high, a trough a confirmed low. Pivots alternate
between them.
_Avoid_: top/bottom, high/low (for the pivot itself)

**Running extreme**:
The highest high (or lowest low) since the last pivot, not yet confirmed. It becomes a pivot once
the threshold is met and is never emitted before that.
_Avoid_: pending pivot, last pivot

**ZigZag threshold (θ)**:
The minimum counter-move, as a fraction of price, that confirms a pivot on a timeframe.
_Avoid_: deviation, sensitivity

**Count**:
A labelling of consecutive pivots as waves (0–5 of an impulse, A–C of a correction), complete or
partial, whose last point is the latest confirmed pivot.
_Avoid_: wave count, reading, labelling

**Anchor**:
The pivot a count starts from, labelled (0); a trough anchors a bullish count, a peak a bearish one.
_Avoid_: origin, start pivot

**Candidate count**:
A count generated from an anchor and not yet checked against the rules; the ones that pass are
valid counts.
_Avoid_: hypothesis, option

**Grade**:
How close one measured ratio sits to its nearest Fibonacci target, from 0 (beyond the tolerance)
to 1 (on target).
_Avoid_: fit, match

**Score**:
The mean of a count's grades, from 0 to 1; it ranks counts into scenarios.
_Avoid_: rating, probability

**Wave in progress**:
The leg running from a count's last point to the current price.
_Avoid_: current wave, live wave

**Scenario**:
A count promoted to Primary or Alternative, carrying a confidence and an invalidation price.
_Avoid_: hypothesis, thesis (for the whole object)

**Primary Scenario**:
The highest-scoring scenario on a timeframe.
_Avoid_: primary count, main count

**Alternative Scenario**:
The second-highest-scoring scenario on a timeframe; the reading that holds if the Primary Scenario
is invalidated.
_Avoid_: alternate count, fallback

**Confidence**:
The weight of a scenario relative to the other one on the same timeframe, from 0 to 100.
_Avoid_: probability, likelihood

**Scenario direction**:
The direction of the wave in progress, i.e. the next expected move; it opposes the impulse's
direction during corrective waves.
_Avoid_: trend, bias

**Projected point**:
A wave point not yet formed, placed by Fibonacci ratios from the count's last point. The chain of
projected points is the count's **projection**.
_Avoid_: forecast, prediction, target (for the point itself)

**Thesis**:
The one-sentence reading of a scenario: what has formed, what is in progress and where it dies.
_Avoid_: summary, narrative

**Invalidation price**:
The price whose breach kills the scenario: past it, an Elliott rule breaks or the count's
structure no longer holds.
_Avoid_: stop (when speaking of a scenario rather than a signal)

**Neutral timeframe**:
A timeframe with no valid count, hence no scenario and no signal.
_Avoid_: flat, undefined

## Trading

**Setup**:
A rule template stating which wave state is worth entering and where the stop loss and targets
sit (Setup 1 Wave 2→3, Setup 2 Wave 4→5, Setup 3a Wave 5 exhaustion, Setup 3b Wave B→C),
mirrored for both directions.
_Avoid_: strategy, signal (for the template)

**Trigger**:
The condition a setup measures at candle close that separates an Active signal from a Watching one.
_Avoid_: condition, entry rule

**Breach**:
Price crossing the invalidation price, which kills a scenario and its signal.
_Avoid_: hit, touch

**Signal**:
A concrete instance of a setup on one timeframe, with entry, stop loss, TP1, TP2 and a status.
_Avoid_: setup (for the instance), trade, recommendation

**Signal status**:
Active when the trigger is met and the trade is still worth taking; Watching when a scenario
exists but entry is not (or no longer) worth it; Invalidated when price breached the scenario's
invalidation price before the next candle close.
_Avoid_: state, phase

**Risk per trade**:
The share of the user's capital they accept to lose if a signal's stop loss is hit; it places the
stop loss that far from the entry.
_Avoid_: risk tolerance, max loss

**Position size**:
The amount committed to a signal: always the user's whole capital, 1x.
_Avoid_: lot, allocation, stake

**Confluence vote**:
The Scenario direction of a non-Neutral timeframe's Primary Scenario. Neutral timeframes do not
vote, and the Alternative Scenario never votes.
_Avoid_: signal, bias

**Confluence**:
How many of the six timeframes cast the same confluence vote, counted on the largest group:
6/6 is Strong Confluence; 5/6, 4/6 or 3/6 is Mixed Market, with the majority direction or, on a
3–3 tie, a split; 2/6 or fewer is No Confluence, with no majority direction.
_Avoid_: consensus, alignment
