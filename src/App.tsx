import { ConfluenceStrip } from './components/ConfluenceStrip.tsx';
import { Header } from './components/Header.tsx';
import { SignalPanel } from './components/SignalPanel.tsx';

export default function App() {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <Header className="h-14" />
      <ConfluenceStrip className="h-24" />
      <main className="flex min-h-0 flex-1 gap-2">
        {/* ElliottChart is wired to live data in Phase 9. */}
        <section className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-slate-500">
          ElliottChart
        </section>
        <SignalPanel className="w-96" />
      </main>
    </div>
  );
}
