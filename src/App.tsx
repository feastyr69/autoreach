import { useState } from 'react';
import type { PageId } from './types';
import { usePipeline } from './hooks/usePipeline';
import Sidebar from './components/Sidebar';
import DomainInput from './components/DomainInput';
import PipelineStepper from './components/PipelineStepper';
import SafetyCheckpoint from './components/SafetyCheckpoint';
import TerminalLog from './components/TerminalLog';
import PlaceholderPage from './components/PlaceholderPage';
import { CheckCircle2, XCircle, Activity } from 'lucide-react';

function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const pipeline = usePipeline();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {activePage === 'dashboard' ? (
          <div className="p-8 max-w-[1400px] mx-auto space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
                  Pipeline Dashboard
                </h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Automated cold-outreach from a single domain seed
                </p>
              </div>

              {/* Status pill */}
              {pipeline.phase !== 'idle' && (
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border ${
                    pipeline.phase === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : pipeline.phase === 'cancelled' || pipeline.phase === 'error'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                  }`}
                >
                  {pipeline.phase === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : pipeline.phase === 'cancelled' || pipeline.phase === 'error' ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 animate-pulse" />
                  )}
                  {pipeline.phase === 'running'
                    ? 'Pipeline Running'
                    : pipeline.phase === 'checkpoint'
                    ? 'Awaiting Approval'
                    : pipeline.phase === 'approved'
                    ? 'Sending Outreach'
                    : pipeline.phase === 'completed'
                    ? 'Pipeline Complete'
                    : pipeline.phase === 'cancelled'
                    ? 'Pipeline Cancelled'
                    : 'Pipeline Error'}
                </div>
              )}
            </div>

            {/* Domain Input */}
            <DomainInput
              phase={pipeline.phase}
              sandboxMode={pipeline.sandboxMode}
              onToggleSandbox={pipeline.setSandboxMode}
              onLaunch={pipeline.launchPipeline}
              onReset={pipeline.resetPipeline}
            />

            {/* Pipeline Stepper */}
            <PipelineStepper stages={pipeline.stages} />

            {/* Safety Checkpoint (conditional) */}
            {pipeline.phase === 'checkpoint' && (
              <SafetyCheckpoint
                leads={pipeline.leads}
                onApprove={pipeline.approveOutreach}
                onCancel={pipeline.cancelRun}
              />
            )}

            {/* Terminal Log */}
            <TerminalLog logs={pipeline.logs} />
          </div>
        ) : (
          <div className="p-8">
            <PlaceholderPage pageId={activePage} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
