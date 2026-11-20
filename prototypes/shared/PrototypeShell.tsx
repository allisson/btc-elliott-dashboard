// PROTOTYPE ONLY. Banner, dev bar and the UI state every prototype shares.
import { AlertTriangle, RotateCw } from 'lucide-react';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RiskSettings, Timeframe } from '../../src/types.ts';
import { MOCK_PRICE, PRICE_PRESETS, parseRisk } from './mock.ts';

export type Mode = 'live' | 'offline' | 'error';
export type Rank = 'primary' | 'alternative';

interface PrototypeState {
  mode: Mode;
  price: number;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  rank: Rank;
  setRank: (r: Rank) => void;
  showProjections: boolean;
  setShowProjections: (v: boolean) => void;
  showTrade: boolean;
  setShowTrade: (v: boolean) => void;
  capitalInput: string;
  setCapitalInput: (v: string) => void;
  riskInput: string;
  setRiskInput: (v: string) => void;
  risk: RiskSettings;
}

const Ctx = createContext<PrototypeState | null>(null);

export function usePrototype(): PrototypeState {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrototype outside PrototypeShell');
  return v;
}

const PROTOS = [
  { id: 'a', name: 'A · Terminal' },
  { id: 'b', name: 'B · Signal-first' },
  { id: 'c', name: 'C · Multi-timeframe grid' },
] as const;

export function PrototypeShell({ id, children }: { id: 'a' | 'b' | 'c'; children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('live');
  const [price, setPrice] = useState<number>(MOCK_PRICE);
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [rank, setRank] = useState<Rank>('primary');
  const [showProjections, setShowProjections] = useState(true);
  const [showTrade, setShowTrade] = useState(true);
  const [capitalInput, setCapitalInput] = useState('1000');
  const [riskInput, setRiskInput] = useState('1');
  const risk = useMemo(() => parseRisk(capitalInput, riskInput), [capitalInput, riskInput]);

  const state: PrototypeState = {
    mode, price, timeframe, setTimeframe, rank, setRank, showProjections, setShowProjections,
    showTrade, setShowTrade, capitalInput, setCapitalInput, riskInput, setRiskInput, risk,
  };

  return (
    <Ctx.Provider value={state}>
      <div className="flex h-full flex-col">
        <div className="flex h-6 shrink-0 items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,#f0b90b_0_10px,#d4a20a_10px_20px)] text-[11px] font-bold tracking-widest text-black">
          PROTOTYPE · MOCK DATA · {PROTOS.find((p) => p.id === id)!.name.toUpperCase()}
        </div>
        <div className="relative min-h-0 flex-1">{mode === 'error' ? <ErrorScreen /> : children}</div>
        <DevBar id={id} mode={mode} setMode={setMode} price={price} setPrice={setPrice} />
      </div>
    </Ctx.Provider>
  );
}

function DevBar(props: {
  id: string;
  mode: Mode;
  setMode: (m: Mode) => void;
  price: number;
  setPrice: (p: number) => void;
}) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-50 rounded-full border border-accent/60 bg-black/80 px-3 py-1 text-[11px] font-semibold text-accent"
      >
        DEV
      </button>
    );
  }
  const btn = (active: boolean) =>
    `rounded px-2 py-0.5 ${active ? 'bg-accent text-black' : 'text-slate-300 hover:bg-white/10'}`;
  return (
    <div className="fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-accent/60 bg-black/85 px-3 py-2 text-[11px] text-slate-300 shadow-xl backdrop-blur">
      <span className="font-bold text-accent">DEV</span>
      <div className="flex gap-1">
        {PROTOS.map((p) => (
          <a key={p.id} href={`/prototypes/${p.id}/`} className={btn(p.id === props.id)}>
            {p.id.toUpperCase()}
          </a>
        ))}
      </div>
      <div className="flex gap-1">
        {(['live', 'offline', 'error'] as const).map((m) => (
          <button key={m} onClick={() => props.setMode(m)} className={btn(props.mode === m)}>
            {m}
          </button>
        ))}
      </div>
      <select
        value={props.price}
        onChange={(e) => props.setPrice(Number(e.target.value))}
        className="rounded border border-border bg-surface px-1 py-0.5"
      >
        {PRICE_PRESETS.map((p) => (
          <option key={p.price} value={p.price}>
            {p.label}
          </option>
        ))}
      </select>
      <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200" aria-label="Hide dev bar">
        ×
      </button>
    </div>
  );
}

/** §3.4 initial REST failure: full screen, no chart, no signals. Shared by all prototypes. */
function ErrorScreen() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-bearish/40 bg-surface p-6">
        <div className="flex items-center gap-2 text-bearish">
          <AlertTriangle size={20} />
          <h1 className="text-base font-semibold">Could not load market data</h1>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Endpoint</dt>
            <dd className="font-mono text-[13px] break-all text-slate-200">
              GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&amp;interval=1w&amp;limit=1000
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">HTTP status</dt>
            <dd className="font-mono text-slate-200">429 Too Many Requests</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-400">No chart and no signals are shown without real data.</p>
        <button className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-black hover:brightness-110">
          <RotateCw size={16} /> Retry
        </button>
      </div>
    </div>
  );
}
