import { Router } from 'express';

export const eazyreachRouter = Router();

interface EazyreachLead {
  name: string;
  linkedinUrl: string;
  email?: string;
  emailStatus?: string;
  [key: string]: unknown;
}

/**
 * POST /api/eazyreach/resolve-emails
 * Body: { leads: Array<{ name, linkedinUrl, ... }> }
 * Returns: { leads: Array<{ ...lead, email, emailStatus }> }
 *
 * Eazyreach uses client_id + client_secret OAuth2 flow.
 * If the API is unreachable, falls back to Prospeo enrichment
 * or marks emails as "unverified".
 */
eazyreachRouter.post('/resolve-emails', async (req, res) => {
  const { leads } = req.body;
  const clientId = process.env.EAZYREACH_ID;
  const clientSecret = process.env.EAZYREACH_SECRET;

  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: 'leads array is required' });
  }

  if (!clientId || !clientSecret) {
    console.warn('[Eazyreach] Credentials not configured. Passing leads through unmodified.');
    return res.json({ leads, warning: 'Eazyreach credentials not configured' });
  }

  try {
    // Step 1: Obtain access token via client credentials
    console.log('[Eazyreach] Authenticating with client credentials...');

    let accessToken: string | null = null;

    try {
      const authResponse = await fetch('https://api.eazyreach.io/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (authResponse.ok) {
        const authData = await authResponse.json() as { access_token?: string };
        accessToken = authData.access_token ?? null;
        console.log('[Eazyreach] Authentication successful');
      } else {
        console.warn(`[Eazyreach] Auth failed: ${authResponse.status}. Falling back to passthrough.`);
      }
    } catch (authErr) {
      console.warn('[Eazyreach] Auth endpoint unreachable. Falling back to passthrough.', authErr);
    }

    // If we can't authenticate, return leads as-is (they may already have email from Prospeo)
    if (!accessToken) {
      console.warn('[Eazyreach] Skipping email resolution (no access token). Leads pass through.');
      const passedLeads = leads.map((lead: EazyreachLead) => ({
        ...lead,
        emailStatus: lead.email ? (lead.emailStatus || 'unverified') : 'missing',
      }));
      return res.json({ leads: passedLeads, warning: 'Eazyreach auth failed, using existing data' });
    }

    // Step 2: Resolve emails for each lead
    const resolvedLeads = [];

    for (const lead of leads) {
      if (!lead.linkedinUrl) {
        resolvedLeads.push({
          ...lead,
          email: lead.email || '',
          emailStatus: lead.email ? 'unverified' : 'missing',
        });
        continue;
      }

      try {
        console.log(`[Eazyreach] Resolving email for ${lead.name}`);

        const resolveResponse = await fetch('https://api.eazyreach.io/v1/resolve-email', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            linkedin_url: lead.linkedinUrl,
            name: lead.name,
            company_domain: lead.domain,
          }),
        });

        if (resolveResponse.ok) {
          const data = await resolveResponse.json() as { email?: string; result?: { email?: string }; verified?: boolean; status?: string };
          const email = data.email || data.result?.email || lead.email || '';
          const status = data.verified
            ? 'verified'
            : data.status === 'verified'
            ? 'verified'
            : email
            ? 'unverified'
            : 'missing';

          resolvedLeads.push({ ...lead, email, emailStatus: status });
        } else if (resolveResponse.status === 429) {
          console.warn('[Eazyreach] Rate limited. Pausing 2s...');
          await new Promise((r) => setTimeout(r, 2000));
          resolvedLeads.push({
            ...lead,
            email: lead.email || '',
            emailStatus: lead.email ? 'unverified' : 'skipped',
          });
        } else {
          console.warn(`[Eazyreach] Resolution failed for ${lead.name}: ${resolveResponse.status}`);
          resolvedLeads.push({
            ...lead,
            email: lead.email || '',
            emailStatus: lead.email ? 'unverified' : 'missing',
          });
        }
      } catch (innerErr) {
        console.warn(`[Eazyreach] Error resolving ${lead.name}:`, innerErr);
        resolvedLeads.push({
          ...lead,
          email: lead.email || '',
          emailStatus: lead.email ? 'unverified' : 'missing',
        });
      }

      // Small delay between requests
      await new Promise((r) => setTimeout(r, 200));
    }

    const verified = resolvedLeads.filter((l) => l.emailStatus === 'verified').length;
    const withEmail = resolvedLeads.filter((l) => l.email).length;
    console.log(`[Eazyreach] Resolution complete: ${verified} verified, ${withEmail} with email, ${resolvedLeads.length} total`);

    res.json({ leads: resolvedLeads });
  } catch (err) {
    console.error('[Eazyreach] Request failed:', err);
    // Graceful fallback — return leads as-is
    const fallbackLeads = leads.map((lead: EazyreachLead) => ({
      ...lead,
      emailStatus: lead.email ? 'unverified' : 'missing',
    }));
    res.json({ leads: fallbackLeads, warning: 'Eazyreach service unavailable, using existing data' });
  }
});
