import { useState, useCallback, useRef } from 'react';
import type { StageState, LogEntry, Lead, PipelinePhase, LogLevel } from '../types';
import { LOOKALIKE_DOMAINS, MOCK_LEADS, getLogMessages } from '../mockData';

const INITIAL_STAGES: StageState[] = [
  { id: 'sourcing', label: 'Sourcing', apiSource: 'Ocean.io', status: 'idle', progress: 0, message: 'Waiting to start' },
  { id: 'decision-makers', label: 'Decision-Makers', apiSource: 'Prospeo', status: 'idle', progress: 0, message: 'Waiting to start' },
  { id: 'email-resolution', label: 'Email Resolution', apiSource: 'Eazyreach', status: 'idle', progress: 0, message: 'Waiting to start' },
  { id: 'outreach', label: 'Outreach', apiSource: 'Brevo', status: 'idle', progress: 0, message: 'Waiting to start' },
];

let logIdCounter = 0;
function createLog(level: LogLevel, message: string): LogEntry {
  return {
    id: `log-${++logIdCounter}`,
    timestamp: new Date(),
    level,
    message,
  };
}

export function usePipeline() {
  const [phase, setPhase] = useState<PipelinePhase>('idle');
  const [stages, setStages] = useState<StageState[]>(INITIAL_STAGES);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [domain, setDomain] = useState('');
  const [sandboxMode, setSandboxMode] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addLog = useCallback((level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, createLog(level, message)]);
  }, []);

  const updateStage = useCallback((index: number, updates: Partial<StageState>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const runStage = useCallback(
    (
      stageIndex: number,
      logEntries: { delay: number; level: LogLevel; message: string }[],
      totalDuration: number,
      resultCount: number,
      onComplete: () => void
    ) => {
      updateStage(stageIndex, { status: 'running', progress: 0, message: 'Processing...' });

      // Schedule log entries
      logEntries.forEach((entry) => {
        const timer = setTimeout(() => {
          addLog(entry.level, entry.message);
          if (entry.level === 'warn' && entry.message.includes('rate limit')) {
            updateStage(stageIndex, { status: 'rate-limited', message: 'Rate Limited - Retrying...' });
            const clearTimer = setTimeout(() => {
              updateStage(stageIndex, { status: 'running', message: 'Processing...' });
            }, 800);
            timersRef.current.push(clearTimer);
          }
        }, entry.delay);
        timersRef.current.push(timer);
      });

      // Animate progress
      const steps = 20;
      const interval = totalDuration / steps;
      for (let i = 1; i <= steps; i++) {
        const timer = setTimeout(() => {
          updateStage(stageIndex, { progress: Math.min((i / steps) * 100, 100) });
        }, interval * i);
        timersRef.current.push(timer);
      }

      // Complete
      const completeTimer = setTimeout(() => {
        updateStage(stageIndex, {
          status: 'success',
          progress: 100,
          message: 'Complete',
          resultCount,
        });
        onComplete();
      }, totalDuration);
      timersRef.current.push(completeTimer);
    },
    [addLog, updateStage]
  );

  const launchPipeline = useCallback(
    (inputDomain: string) => {
      if (!inputDomain.trim()) return;

      // Reset everything
      logIdCounter = 0;
      setDomain(inputDomain.trim());
      setPhase('running');
      setStages(INITIAL_STAGES.map((s) => ({ ...s })));
      setLogs([]);
      setLeads([]);
      clearTimers();

      const logMsgs = getLogMessages(inputDomain.trim(), sandboxMode);

      addLog('info', `━━━ Pipeline started for "${inputDomain.trim()}" ━━━`);
      if (sandboxMode) {
        addLog('warn', '🧪 Sandbox Mode enabled — outreach emails will be intercepted');
      }

      // Stage 1: Sourcing (3s)
      runStage(0, logMsgs.sourcing, 3000, LOOKALIKE_DOMAINS.length, () => {
        // Stage 2: Decision-Makers (4s)
        runStage(1, logMsgs.decisionMakers, 4500, MOCK_LEADS.length, () => {
          // Stage 3: Email Resolution (3s)
          runStage(2, logMsgs.emailResolution, 3500, MOCK_LEADS.filter((l) => l.emailStatus === 'verified').length, () => {
            // Pause before Stage 4
            setLeads(MOCK_LEADS);
            setPhase('checkpoint');
            updateStage(3, { status: 'paused', message: 'Awaiting approval...' });
            addLog('warn', '⚠ Pipeline paused — Human review required before outreach.');
            addLog('info', `${MOCK_LEADS.length} leads discovered. Awaiting approval to fire campaign.`);
          });
        });
      });
    },
    [sandboxMode, addLog, clearTimers, runStage, updateStage]
  );

  const approveOutreach = useCallback(() => {
    setPhase('approved');
    addLog('success', '✅ Outreach approved by operator. Firing campaign...');

    const logMsgs = getLogMessages(domain, sandboxMode);
    runStage(3, logMsgs.outreach, 2800, MOCK_LEADS.filter((l) => l.emailStatus === 'verified').length, () => {
      setPhase('completed');
      addLog('success', '━━━ Pipeline finished successfully ━━━');
    });
  }, [domain, sandboxMode, addLog, runStage]);

  const cancelRun = useCallback(() => {
    clearTimers();
    setPhase('cancelled');
    updateStage(3, { status: 'error', message: 'Cancelled by operator' });
    addLog('error', '✖ Pipeline cancelled by operator. No emails were sent.');
    addLog('info', '━━━ Pipeline aborted ━━━');
  }, [clearTimers, updateStage, addLog]);

  const resetPipeline = useCallback(() => {
    clearTimers();
    logIdCounter = 0;
    setPhase('idle');
    setStages(INITIAL_STAGES.map((s) => ({ ...s })));
    setLogs([]);
    setLeads([]);
    setDomain('');
  }, [clearTimers]);

  return {
    phase,
    stages,
    logs,
    leads,
    domain,
    sandboxMode,
    setSandboxMode,
    launchPipeline,
    approveOutreach,
    cancelRun,
    resetPipeline,
  };
}
