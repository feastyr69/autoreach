import { Router } from 'express';

export const prospeoRouter = Router();

interface ProspeoPersonResult {
  person_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  job_title?: string;
  company_name?: string;
  company_domain?: string;
  linkedin_url?: string;
  email?: string;
}

interface ProspeoEnrichResult {
  email?: string;
  email_status?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  company_name?: string;
  company_domain?: string;
  linkedin_url?: string;
}

/**
 * POST /api/prospeo/decision-makers
 * Body: { domains: string[] }
 * Returns: { leads: Array<{ name, title, company, domain, linkedinUrl, personId }> }
 */
prospeoRouter.post('/decision-makers', async (req, res) => {
  const { domains } = req.body;
  const apiKey = process.env.PROSPEO_API;

  if (!apiKey) {
    return res.status(500).json({ error: 'PROSPEO_API key not configured' });
  }

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'domains array is required' });
  }

  try {
    const allLeads: Array<{
      name: string;
      title: string;
      company: string;
      domain: string;
      linkedinUrl: string;
      personId?: string;
    }> = [];

    for (const domain of domains) {
      console.log(`[Prospeo] Searching decision-makers at "${domain}"`);

      const response = await fetch('https://api.prospeo.io/search-person', {
        method: 'POST',
        headers: {
          'X-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: {
            company_domain: domain,
            person_seniority: ['C-Level', 'VP', 'Director'],
          },
          page: 1,
        }),
      });

      if (response.status === 429) {
        console.warn(`[Prospeo] Rate limited on domain "${domain}". Waiting 3s...`);
        await new Promise((r) => setTimeout(r, 3000));

        // Retry once
        const retryResponse = await fetch('https://api.prospeo.io/search-person', {
          method: 'POST',
          headers: {
            'X-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              company_domain: domain,
              person_seniority: ['C-Level', 'VP', 'Director'],
            },
            page: 1,
          }),
        });

        if (!retryResponse.ok) {
          console.error(`[Prospeo] Retry failed for "${domain}": ${retryResponse.status}`);
          continue;
        }

        const retryData = await retryResponse.json() as { results?: ProspeoPersonResult[]; data?: ProspeoPersonResult[] };
        const retryResults: ProspeoPersonResult[] = retryData.results || retryData.data || [];
        for (const person of retryResults) {
          allLeads.push({
            name: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            title: person.title || person.job_title || 'Executive',
            company: person.company_name || domain,
            domain,
            linkedinUrl: person.linkedin_url || '',
            personId: person.person_id,
          });
        }
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[Prospeo] Error for "${domain}": ${response.status}`, errBody);
        continue;
      }

      const data = await response.json() as { results?: ProspeoPersonResult[]; data?: ProspeoPersonResult[] };
      const results: ProspeoPersonResult[] = data.results || data.data || [];

      console.log(`[Prospeo] Found ${results.length} decision-makers at "${domain}"`);

      for (const person of results) {
        allLeads.push({
          name: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
          title: person.title || person.job_title || 'Executive',
          company: person.company_name || domain,
          domain,
          linkedinUrl: person.linkedin_url || '',
          personId: person.person_id,
        });
      }

      // Small delay between domain requests to avoid rate limits
      if (domains.indexOf(domain) < domains.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`[Prospeo] Total leads found: ${allLeads.length}`);
    res.json({ leads: allLeads });
  } catch (err) {
    console.error('[Prospeo] Request failed:', err);
    res.status(500).json({ error: 'Failed to connect to Prospeo', details: String(err) });
  }
});

/**
 * POST /api/prospeo/enrich
 * Body: { leads: Array<{ linkedinUrl: string, name: string, ... }> }
 * Returns: { leads: Array<{ ...lead, email, emailStatus }> }
 */
prospeoRouter.post('/enrich', async (req, res) => {
  const { leads } = req.body;
  const apiKey = process.env.PROSPEO_API;

  if (!apiKey) {
    return res.status(500).json({ error: 'PROSPEO_API key not configured' });
  }

  if (!leads || !Array.isArray(leads)) {
    return res.status(400).json({ error: 'leads array is required' });
  }

  try {
    const enrichedLeads = [];

    for (const lead of leads) {
      if (!lead.linkedinUrl) {
        enrichedLeads.push({ ...lead, email: '', emailStatus: 'missing' });
        continue;
      }

      console.log(`[Prospeo] Enriching ${lead.name} (${lead.linkedinUrl})`);

      try {
        const response = await fetch('https://api.prospeo.io/enrich-person', {
          method: 'POST',
          headers: {
            'X-KEY': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: lead.linkedinUrl }),
        });

        if (response.status === 429) {
          console.warn(`[Prospeo] Rate limited during enrichment. Waiting 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
          enrichedLeads.push({ ...lead, email: '', emailStatus: 'unverified' });
          continue;
        }

        if (!response.ok) {
          console.warn(`[Prospeo] Enrich failed for ${lead.name}: ${response.status}`);
          enrichedLeads.push({ ...lead, email: '', emailStatus: 'missing' });
          continue;
        }

        const rawData = await response.json() as { response?: ProspeoEnrichResult } & ProspeoEnrichResult;
        const data: ProspeoEnrichResult = rawData.response || rawData;
        const email = data.email || '';
        const emailStatus = data.email_status === 'valid' || data.email_status === 'verified'
          ? 'verified'
          : email
          ? 'unverified'
          : 'missing';

        enrichedLeads.push({
          ...lead,
          email,
          emailStatus,
          // Update name/title from enrichment if missing
          name: lead.name || data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          title: lead.title || data.title || 'Executive',
        });
      } catch (innerErr) {
        console.warn(`[Prospeo] Enrich error for ${lead.name}:`, innerErr);
        enrichedLeads.push({ ...lead, email: '', emailStatus: 'missing' });
      }

      // Small delay between enrichment requests
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`[Prospeo] Enrichment complete: ${enrichedLeads.filter((l) => l.email).length}/${enrichedLeads.length} emails found`);
    res.json({ leads: enrichedLeads });
  } catch (err) {
    console.error('[Prospeo] Enrichment failed:', err);
    res.status(500).json({ error: 'Failed to enrich via Prospeo', details: String(err) });
  }
});
