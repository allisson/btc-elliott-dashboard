import { ConfluenceStrip } from './components/ConfluenceStrip.tsx';
import { ElliottChart } from './components/ElliottChart.tsx';
import { Header } from './components/Header.tsx';
import { SignalPanel } from './components/SignalPanel.tsx';

export default function App() {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <Header className="h-14" />
      <ConfluenceStrip className="h-24" />
      <main className="flex min-h-0 flex-1 gap-2">
        <ElliottChart className="flex-1" />
        <SignalPanel className="w-96" />
      </main>
    </div>
  );
}
