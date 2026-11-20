# No synthetic data at runtime

An early design loaded synthetic deterministic candles whenever Binance is unreachable, so that
the UI and Elliott calculations stay operational. We drop that. The dashboard emits LONG/SHORT
signals, and a signal computed on invented prices looks exactly like a real one. On failure the
app shows an explicit error or offline state with the last real data and suppresses every signal.
Synthetic candles exist only as test fixtures.
