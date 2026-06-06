import { useState } from 'react';
import { Rocket, RotateCcw, ToggleLeft, ToggleRight, Globe } from 'lucide-react';
import type { PipelinePhase } from '../types';

interface DomainInputProps {
  phase: PipelinePhase;
  sandboxMode: boolean;
  onToggleSandbox: (value: boolean) => void;
  onLaunch: (domain: string) => void;
  onReset: () => void;
}

export default function DomainInput({
  phase,
  sandboxMode,
  onToggleSandbox,
  onLaunch,
  onReset,
}: DomainInputProps) {
  const [inputValue, setInputValue] = useState('');
  const isRunning = phase === 'running' || phase === 'approved';
  const isFinished = phase === 'completed' || phase === 'cancelled' || phase === 'error';

  const handleLaunch = () => {
    if (inputValue.trim() && !isRunning) {
      onLaunch(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLaunch();
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5 text-violet-400" />
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Launch New Pipeline
        </h2>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            id="domain-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning || phase === 'checkpoint'}
            placeholder="enter a company domain to start... e.g., stripe.com"
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          />
        </div>

        {isFinished ? (
          <button
            id="reset-pipeline-btn"
            onClick={onReset}
            className="flex items-center gap-2 px-6 py-3.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4" />
            New Run
          </button>
        ) : (
          <button
            id="launch-pipeline-btn"
            onClick={handleLaunch}
            disabled={!inputValue.trim() || isRunning || phase === 'checkpoint'}
            className="flex items-center gap-2 px-6 py-3.5 bg-violet-700 hover:bg-violet-800 text-white rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            <Rocket className="w-4 h-4" />
            Launch Pipeline
          </button>
        )}
      </div>

      {/* Sandbox Toggle */}
      <div className="mt-4 flex items-center gap-3">
        <button
          id="sandbox-toggle"
          onClick={() => onToggleSandbox(!sandboxMode)}
          disabled={isRunning || phase === 'checkpoint'}
          className="relative flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sandboxMode ? (
            <ToggleRight className="w-7 h-7 text-amber-400" />
          ) : (
            <ToggleLeft className="w-7 h-7 text-zinc-600" />
          )}
          <span className={sandboxMode ? 'text-amber-400 font-medium' : ''}>
            Enable Sandbox Mode
          </span>
        </button>
        {sandboxMode && (
          <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium">
            Intercept & redirect final emails to test inbox
          </span>
        )}
      </div>
    </div>
  );
}
