import { useState, useCallback, useRef } from 'react';
import type { StageState, LogEntry, Lead, PipelinePhase, LogLevel } from '../types';
import {
  findLookalikes,
  findDecisionMakers,
  resolveEmails,
  sendCampaign,
  ApiError,
} from '../services/api';
import type { LookalikeDomain, RawLead, EnrichedLead } from '../services/api';

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
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((level: LogLevel, message: string) => {
    setLogs((prev) => [...prev, createLog(level, message)]);
  }, []);

  const updateStage = useCallback((index: number, updates: Partial<StageState>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  /** Start an indeterminate progress animation for a stage */
  const startProgress = useCallback((stageIndex: number) => {
    let progress = 0;
    progressTimerRef.current = setInterval(() => {
      progress = Math.min(progress + Math.random() * 8 + 2, 90);
      updateStage(stageIndex, { progress });
    }, 400);
  }, [updateStage]);

  /** Stop the progress animation */
  const stopProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  // ─── Stage 1: Sourcing (Ocean.io) ─────────────────────────────────────

  const runSourcing = useCallback(async (inputDomain: string): Promise<LookalikeDomain[] | null> => {
    updateStage(0, { status: 'running', progress: 0, message: 'Connecting to Ocean.io...' });
    addLog('info', 'Initializing Ocean.io API connection...');
    startProgress(0);

    try {
      addLog('info', `Querying Ocean.io for lookalikes of "${inputDomain}"`);
      const domains = await findLookalikes(inputDomain);

      stopProgress();
      updateStage(0, {
        status: 'success',
        progress: 100,
        message: 'Complete',
        resultCount: domains.length,
      });
      addLog('success', `Found ${domains.length} similar domains: ${domains.map((d) => d.domain).join(', ')}`);
      addLog('info', `Sourcing stage complete. Passing ${domains.length} domains to Prospeo.`);

      return domains;
    } catch (err) {
      stopProgress();
      const message = err instanceof ApiError ? err.message : 'Failed to connect to Ocean.io';

      if (err instanceof ApiError && err.status === 429) {
        updateStage(0, { status: 'rate-limited', message: 'Rate limited — retrying...' });
        addLog('warn', 'Ocean.io rate limit hit (429). Waiting 3s...');
        await new Promise((r) => setTimeout(r, 3000));

        // Retry once
        try {
          addLog('info', 'Rate limit cleared. Retrying Ocean.io...');
          updateStage(0, { status: 'running', message: 'Retrying...' });
          startProgress(0);
          const domains = await findLookalikes(inputDomain);

          stopProgress();
          updateStage(0, {
            status: 'success',
            progress: 100,
            message: 'Complete',
            resultCount: domains.length,
          });
          addLog('success', `Found ${domains.length} similar domains`);
          return domains;
        } catch {
          stopProgress();
          updateStage(0, { status: 'error', progress: 0, message: 'Failed after retry' });
          addLog('error', `Ocean.io failed after retry: ${message}`);
          return null;
        }
      }

      updateStage(0, { status: 'error', progress: 0, message });
      addLog('error', `Sourcing failed: ${message}`);
      return null;
    }
  }, [addLog, updateStage, startProgress, stopProgress]);

  // ─── Stage 2: Decision-Makers (Prospeo) ───────────────────────────────

  const runDecisionMakers = useCallback(async (domains: LookalikeDomain[]): Promise<RawLead[] | null> => {
    updateStage(1, { status: 'running', progress: 0, message: 'Searching for decision-makers...' });
    addLog('info', 'Initializing Prospeo API for decision-maker lookup...');
    startProgress(1);

    try {
      const domainList = domains.map((d) => d.domain);
      addLog('info', `Scanning ${domainList.length} domains for C-suite & VP-level contacts...`);

      const rawLeads = await findDecisionMakers(domainList);

      stopProgress();
      updateStage(1, {
        status: 'success',
        progress: 100,
        message: 'Complete',
        resultCount: rawLeads.length,
      });
      addLog('success', `Discovered ${rawLeads.length} total decision-makers across ${domainList.length} companies`);

      return rawLeads;
    } catch (err) {
      stopProgress();
      const message = err instanceof ApiError ? err.message : 'Failed to connect to Prospeo';

      if (err instanceof ApiError && err.status === 429) {
        updateStage(1, { status: 'rate-limited', message: 'Rate limited — retrying...' });
        addLog('warn', 'Prospeo rate limit hit (429). Backing off for 3s...');
        await new Promise((r) => setTimeout(r, 3000));

        try {
          addLog('info', 'Rate limit cleared. Retrying Prospeo...');
          updateStage(1, { status: 'running', message: 'Retrying...' });
          startProgress(1);
          const rawLeads = await findDecisionMakers(domains.map((d) => d.domain));

          stopProgress();
          updateStage(1, {
            status: 'success',
            progress: 100,
            message: 'Complete',
            resultCount: rawLeads.length,
          });
          addLog('success', `Found ${rawLeads.length} decision-makers after retry`);
          return rawLeads;
        } catch {
          stopProgress();
          updateStage(1, { status: 'error', progress: 0, message: 'Failed after retry' });
          addLog('error', 'Prospeo failed after retry');
          return null;
        }
      }

      updateStage(1, { status: 'error', progress: 0, message });
      addLog('error', `Decision-maker search failed: ${message}`);
      return null;
    }
  }, [addLog, updateStage, startProgress, stopProgress]);

  // ─── Stage 3: Email Resolution (Prospeo + Eazyreach) ─────────────────

  const runEmailResolution = useCallback(async (rawLeads: RawLead[]): Promise<EnrichedLead[] | null> => {
    updateStage(2, { status: 'running', progress: 0, message: 'Resolving emails...' });
    addLog('info', 'Connecting to email resolution services...');
    addLog('info', 'Resolving LinkedIn URLs to corporate emails...');
    startProgress(2);

    try {
      const { leads: enrichedLeads, warnings } = await resolveEmails(rawLeads);

      stopProgress();

      const verified = enrichedLeads.filter((l) => l.emailStatus === 'verified').length;
      const unverified = enrichedLeads.filter((l) => l.emailStatus === 'unverified').length;
      const missing = enrichedLeads.filter((l) => l.emailStatus === 'missing' || l.emailStatus === 'skipped').length;

      // Log individual results
      for (const lead of enrichedLeads) {
        if (lead.emailStatus === 'verified') {
          addLog('success', `Verified: ${lead.email} ✓`);
        } else if (lead.emailStatus === 'unverified') {
          addLog('warn', `Unverified: ${lead.email || lead.name} — MX record check inconclusive`);
        } else if (lead.emailStatus === 'skipped') {
          addLog('warn', `Skipped: ${lead.name} (${lead.company}) — No email found`);
        } else {
          addLog('warn', `Missing: ${lead.name} (${lead.company}) — LinkedIn profile missing email data`);
        }
      }

      for (const w of warnings) {
        addLog('warn', `⚠ ${w}`);
      }

      updateStage(2, {
        status: 'success',
        progress: 100,
        message: 'Complete',
        resultCount: verified,
      });
      addLog('info', `Resolution complete. ${verified} verified, ${unverified} unverified, ${missing} missing/skipped`);

      return enrichedLeads;
    } catch (err) {
      stopProgress();
      const message = err instanceof ApiError ? err.message : 'Email resolution failed';
      updateStage(2, { status: 'error', progress: 0, message });
      addLog('error', `Email resolution failed: ${message}`);
      return null;
    }
  }, [addLog, updateStage, startProgress, stopProgress]);

  // ─── Stage 4: Outreach (Brevo) ───────────────────────────────────────

  const runOutreach = useCallback(async (outreachLeads: Lead[], isSandbox: boolean) => {
    updateStage(3, { status: 'running', progress: 0, message: 'Sending outreach...' });

    if (isSandbox) {
      addLog('warn', '🧪 SANDBOX MODE ACTIVE — Emails redirected to test inbox');
    }
    addLog('info', 'Connecting to Brevo transactional API...');
    startProgress(3);

    try {
      const sendableLeads = outreachLeads.filter(
        (l) => l.email && l.emailStatus !== 'missing' && l.emailStatus !== 'skipped'
      );
      addLog('info', `Composing personalized outreach for ${sendableLeads.length} leads...`);

      const result = await sendCampaign(outreachLeads, { sandboxMode: isSandbox });

      stopProgress();

      // Log individual sends
      for (const r of result.results) {
        if (r.status === 'sent') {
          addLog('info', `Sent → ${isSandbox ? 'test-inbox (redirected from ' + r.email + ')' : r.email}`);
        } else if (r.status === 'failed') {
          addLog('error', `Failed → ${r.email}: ${r.error}`);
        } else {
          addLog('warn', `Skipped → ${r.email || 'unknown'}: ${r.error || 'no email'}`);
        }
      }

      updateStage(3, {
        status: 'success',
        progress: 100,
        message: 'Complete',
        resultCount: result.summary.sent,
      });

      if (isSandbox) {
        addLog('success', `All ${result.summary.sent} emails sent to sandbox inbox. No live emails dispatched.`);
        addLog('success', '🎉 Pipeline complete (Sandbox Mode). Check test-inbox@autoreach.dev.');
      } else {
        addLog('success', `All ${result.summary.sent} emails dispatched successfully via Brevo.`);
        addLog('success', `🎉 Pipeline complete. Campaign launched for lookalike outreach.`);
      }

      setPhase('completed');
      addLog('success', '━━━ Pipeline finished successfully ━━━');
    } catch (err) {
      stopProgress();
      const message = err instanceof ApiError ? err.message : 'Outreach campaign failed';
      updateStage(3, { status: 'error', progress: 0, message });
      addLog('error', `Outreach failed: ${message}`);
      setPhase('error');
    }
  }, [addLog, updateStage, startProgress, stopProgress]);

  // ─── Pipeline Orchestration ───────────────────────────────────────────

  const launchPipeline = useCallback(
    async (inputDomain: string) => {
      if (!inputDomain.trim()) return;

      // Reset everything
      logIdCounter = 0;
      const trimmedDomain = inputDomain.trim();
      setDomain(trimmedDomain);
      setPhase('running');
      setStages(INITIAL_STAGES.map((s) => ({ ...s })));
      setLogs([]);
      setLeads([]);

      // Create abort controller for cancellation
      const controller = new AbortController();
      abortRef.current = controller;

      addLog('info', `━━━ Pipeline started for "${trimmedDomain}" ━━━`);
      if (sandboxMode) {
        addLog('warn', '🧪 Sandbox Mode enabled — outreach emails will be intercepted');
      }

      // Stage 1: Sourcing
      const domains = await runSourcing(trimmedDomain);
      if (!domains || controller.signal.aborted) {
        if (!controller.signal.aborted) setPhase('error');
        return;
      }

      // Stage 2: Decision-Makers
      const rawLeads = await runDecisionMakers(domains);
      if (!rawLeads || controller.signal.aborted) {
        if (!controller.signal.aborted) setPhase('error');
        return;
      }

      // Stage 3: Email Resolution
      const enrichedLeads = await runEmailResolution(rawLeads);
      if (!enrichedLeads || controller.signal.aborted) {
        if (!controller.signal.aborted) setPhase('error');
        return;
      }

      // Convert to Lead type for the checkpoint
      const finalLeads: Lead[] = enrichedLeads.map((l, i) => ({
        id: `lead-${i + 1}`,
        company: l.company,
        domain: l.domain,
        name: l.name,
        title: l.title,
        linkedinUrl: l.linkedinUrl,
        email: l.email,
        emailStatus: l.emailStatus,
      }));

      setLeads(finalLeads);
      setPhase('checkpoint');
      updateStage(3, { status: 'paused', message: 'Awaiting approval...' });
      addLog('warn', '⚠ Pipeline paused — Human review required before outreach.');
      addLog('info', `${finalLeads.length} leads discovered. Awaiting approval to fire campaign.`);
    },
    [sandboxMode, addLog, updateStage, runSourcing, runDecisionMakers, runEmailResolution]
  );

  const approveOutreach = useCallback(() => {
    setPhase('approved');
    addLog('success', '✅ Outreach approved by operator. Firing campaign...');
    runOutreach(leads, sandboxMode);
  }, [leads, sandboxMode, addLog, runOutreach]);

  const cancelRun = useCallback(() => {
    // Abort any in-flight requests
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopProgress();
    setPhase('cancelled');
    updateStage(3, { status: 'error', message: 'Cancelled by operator' });
    addLog('error', '✖ Pipeline cancelled by operator. No emails were sent.');
    addLog('info', '━━━ Pipeline aborted ━━━');
  }, [updateStage, addLog, stopProgress]);

  const resetPipeline = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopProgress();
    logIdCounter = 0;
    setPhase('idle');
    setStages(INITIAL_STAGES.map((s) => ({ ...s })));
    setLogs([]);
    setLeads([]);
    setDomain('');
  }, [stopProgress]);

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
