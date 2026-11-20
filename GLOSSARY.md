# BTC Elliott Dashboard

A personal read-only dashboard for the BTC/USDT pair that counts Elliott waves across four
timeframes and turns that reading into unleveraged trade signals.

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
The best scenario whose structure or direction differs from the Primary Scenario; the thesis that
holds if the primary is invalidated.
_Avoid_: alternate count, fallback

**Invalidation price**:
The price whose breach violates an Elliott rule and kills the scenario.
_Avoid_: stop (when speaking of a scenario rather than a signal)

**Neutral timeframe**:
A timeframe with no valid count, hence no scenario and no signal.
_Avoid_: flat, undefined

## Trading

**Setup**:
A rule template stating which wave state is worth entering and where the stop loss and targets
sit (Setup 1 Wave 2→3, Setup 2 Wave 4→5, Setup 3 Exhaustion/ABC), mirrored for both directions.
_Avoid_: strategy, signal (for the template)

**Signal**:
A concrete instance of a setup on one timeframe, with entry, stop loss, TP1, TP2 and a status.
_Avoid_: setup (for the instance), trade, recommendation

**Signal status**:
Active when the trigger is met and the trade is still worth taking; Watching when a scenario
exists but entry is not (or no longer) worth it; Invalidated when price breached the stop loss
before the next candle close.
_Avoid_: state, phase

**Risk per trade**:
The share of the user's capital they accept to lose if a signal's stop loss is hit.
_Avoid_: risk tolerance, max loss

**Position size**:
The amount committed to a signal so that hitting its stop loss loses exactly the risk per trade,
never exceeding the user's capital.
_Avoid_: lot, allocation, stake

**Confluence**:
How many timeframes agree with the majority direction of their Primary Scenarios; 4/4 is Strong
Confluence, 3/4 or 2/4 is Mixed Market.
_Avoid_: consensus, alignment
