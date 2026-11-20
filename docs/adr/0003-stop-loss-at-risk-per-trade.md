# Stop loss at the risk per trade, position always the whole capital

The stop loss used to sit at the setup's structural level (P0 or P1 × 0.995, P5 or PB × 1.008) and
the risk per trade sized the position: with 1000 USDT, 1% and a stop 4% away, the position was
250 USDT. We drop that. The position is always the whole capital (1x), and the risk per trade
places the stop: `SL = entry ∓ risk%`, so hitting it loses exactly `risk%` of the capital (10 USDT
with the defaults).

Because `entry` is the live price, the stop moves with it: the panel says where to put the stop
when entering now. It is therefore never breached, and only the scenario's invalidation price
invalidates a signal. The chart draws that price as its own `INVALIDATION` line, since the stop no
longer marks the count's structure. R:R is measured in units of the risk per trade, so a larger
risk lowers R:R and can turn a signal from Active to Watching.

Accepted cost: on higher timeframes a 1% stop sits inside normal volatility and is often hit by
wicks well before the count is invalidated.
