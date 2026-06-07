import type { Lead } from '../types';

const API_BASE = '/api';

/** Generic fetch wrapper with error handling and retry for rate limits */
async function apiFetch<T>(path: string, body: unknown, retries = 1): Promise<T> {
  const url = `${API_BASE}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < retries) {
      // Rate limited — wait and retry
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new ApiError(
        errData.error || `Request failed: ${response.status}`,
        response.status,
        errData.retryable || false
      );
    }

    return response.json();
  }

  throw new ApiError('Max retries exceeded', 429, true);
}

export class ApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(
    message: string,
    status: number,
    retryable: boolean
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

// ─── Ocean.io: Find lookalike companies ─────────────────────────────────

export interface LookalikeDomain {
  domain: string;
  company: string;
  employeeCount?: number;
  industry?: string;
}

interface OceanResponse {
  domains: LookalikeDomain[];
}

export async function findLookalikes(domain: string, size = 10): Promise<LookalikeDomain[]> {
  const data = await apiFetch<OceanResponse>('/ocean/lookalikes', { domain, size });
  return data.domains;
}

// ─── Prospeo: Find decision-makers ──────────────────────────────────────

export interface RawLead {
  name: string;
  title: string;
  company: string;
  domain: string;
  linkedinUrl: string;
  personId?: string;
}

interface ProspeoSearchResponse {
  leads: RawLead[];
}

export async function findDecisionMakers(domains: string[]): Promise<RawLead[]> {
  const data = await apiFetch<ProspeoSearchResponse>('/prospeo/decision-makers', { domains });
  return data.leads;
}

// ─── Prospeo + Eazyreach: Resolve emails ────────────────────────────────

export interface EnrichedLead {
  name: string;
  title: string;
  company: string;
  domain: string;
  linkedinUrl: string;
  email: string;
  emailStatus: 'verified' | 'unverified' | 'missing' | 'skipped';
}

interface ProspeoEnrichResponse {
  leads: EnrichedLead[];
}

interface EazyreachResponse {
  leads: EnrichedLead[];
  warning?: string;
}

export async function resolveEmails(leads: RawLead[]): Promise<{ leads: EnrichedLead[]; warnings: string[] }> {
  const warnings: string[] = [];

  // Step 1: Try Prospeo enrichment first (most reliable for emails)
  let enrichedLeads: EnrichedLead[];
  try {
    const prospeoData = await apiFetch<ProspeoEnrichResponse>('/prospeo/enrich', { leads });
    enrichedLeads = prospeoData.leads;
  } catch (err) {
    console.warn('[API] Prospeo enrichment failed, trying Eazyreach only:', err);
    warnings.push('Prospeo enrichment unavailable');
    enrichedLeads = leads.map((l) => ({
      ...l,
      email: '',
      emailStatus: 'missing' as const,
    }));
  }

  // Step 2: Pass through Eazyreach for additional resolution / verification
  try {
    const eazyreachData = await apiFetch<EazyreachResponse>('/eazyreach/resolve-emails', {
      leads: enrichedLeads,
    });
    if (eazyreachData.warning) {
      warnings.push(eazyreachData.warning);
    }
    enrichedLeads = eazyreachData.leads;
  } catch (err) {
    console.warn('[API] Eazyreach resolution failed, using Prospeo data:', err);
    warnings.push('Eazyreach service unavailable');
  }

  return { leads: enrichedLeads, warnings };
}

// ─── Brevo: Send outreach campaign ──────────────────────────────────────

interface CampaignResult {
  email: string;
  status: string;
  messageId?: string;
  error?: string;
}

interface CampaignResponse {
  results: CampaignResult[];
  summary: {
    sent: number;
    failed: number;
    total: number;
    sandboxMode: boolean;
  };
}

export interface CampaignOptions {
  sandboxMode: boolean;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  htmlContent?: string;
  testInbox?: string;
}

export async function sendCampaign(
  leads: Lead[],
  options: CampaignOptions
): Promise<CampaignResponse> {
  // Only send to leads with emails
  const sendableLeads = leads.filter((l) => l.email && l.emailStatus !== 'missing' && l.emailStatus !== 'skipped');

  const data = await apiFetch<CampaignResponse>('/brevo/send-campaign', {
    leads: sendableLeads.map((l) => ({
      name: l.name,
      email: l.email,
      company: l.company,
      title: l.title,
    })),
    ...options,
  });

  return data;
}

// ─── Health check ───────────────────────────────────────────────────────

interface HealthResponse {
  status: string;
  keys: {
    ocean: boolean;
    prospeo: boolean;
    eazyreach: boolean;
    brevo: boolean;
  };
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Backend server not reachable');
  }
  return response.json();
}
