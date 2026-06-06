import { useEffect, useRef, useState } from 'react';
import { Terminal, Minimize2, Maximize2 } from 'lucide-react';
import type { LogEntry } from '../types';

interface TerminalLogProps {
  logs: LogEntry[];
}

const LEVEL_STYLES = {
  info: 'text-zinc-400',
  success: 'text-emerald-400',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const LEVEL_LABELS = {
  info: 'INFO',
  success: 'SUCCESS',
  warn: 'WARN',
  error: 'ERROR',
};

export default function TerminalLog({ logs }: TerminalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isMinimized]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-400">Pipeline Logs</span>
          </div>
          {logs.length > 0 && (
            <span className="text-[10px] font-medium text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
              {logs.length} entries
            </span>
          )}
        </div>
        <button
          id="terminal-toggle"
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-zinc-800 rounded-md"
        >
          {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Terminal body */}
      {!isMinimized && (
        <div
          ref={scrollRef}
          className="p-4 h-52 overflow-y-auto font-mono text-[12px] leading-relaxed space-y-0.5 scrollbar-thin"
        >
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-xs italic">
                Logs will appear here when a pipeline is launched...
              </p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-zinc-600 shrink-0 select-none">
                  {formatTime(log.timestamp)}
                </span>
                <span
                  className={`shrink-0 select-none font-semibold w-[68px] text-right ${LEVEL_STYLES[log.level]}`}
                >
                  [{LEVEL_LABELS[log.level]}]
                </span>
                <span className={LEVEL_STYLES[log.level]}>{log.message}</span>
              </div>
            ))
          )}
          {/* Blinking cursor */}
          {logs.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-zinc-600">$</span>
              <span className="w-2 h-4 bg-violet-400/70 animate-pulse rounded-sm" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
