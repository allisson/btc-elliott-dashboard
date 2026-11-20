# Vite SPA instead of Next.js

Next.js (App Router) was the first stack considered. We build a Vite + React static SPA instead. Every data
source (Binance public REST and WebSocket) is called from the browser, and the chart is a
client-only canvas, so Next's server adds SSR/hydration friction around Lightweight Charts and
gains nothing. If server routes become necessary (alerts, a proxy), revisit this.
