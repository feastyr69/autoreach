import { Router } from 'express';

export const oceanRouter = Router();

interface OceanCompany {
  name?: string;
  domain?: string;
  website?: string;
  employeeCountOcean?: number;
  industries?: string[];
}

/**
 * POST /api/ocean/lookalikes
 * Body: { domain: string, size?: number }
 * Returns: { domains: Array<{ domain: string, company: string }> }
 */
oceanRouter.post('/lookalikes', async (req, res) => {
  const { domain, size = 10 } = req.body;
  const apiKey = process.env.OCEAN_API;

  if (!apiKey) {
    return res.status(500).json({ error: 'OCEAN_API key not configured' });
  }

  if (!domain) {
    return res.status(400).json({ error: 'domain is required' });
  }

  try {
    console.log(`[Ocean.io] Searching lookalikes for "${domain}" (size=${size})`);

    const response = await fetch('https://api.ocean.io/v3/search/companies', {
      method: 'POST',
      headers: {
        'X-Api-Token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size,
        companiesFilters: {
          lookalikeDomains: [domain],
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Ocean.io] API error ${response.status}:`, errBody);

      if (response.status === 429) {
        return res.status(429).json({ error: 'Rate limited by Ocean.io. Please wait and retry.', retryable: true });
      }
      return res.status(response.status).json({ error: `Ocean.io API error: ${response.status}`, details: errBody });
    }

    const data = await response.json() as { results?: OceanCompany[]; companies?: Array<{ company: OceanCompany } | OceanCompany> };
    
    let rawCompanies: OceanCompany[] = [];
    if (data.companies) {
      rawCompanies = data.companies.map(item => ('company' in item ? item.company : item)) as OceanCompany[];
    } else if (data.results) {
      rawCompanies = data.results;
    }

    const domains = rawCompanies
      .filter((c: OceanCompany) => c.domain || c.website)
      .map((c: OceanCompany) => ({
        domain: c.domain || c.website || '',
        company: c.name || c.domain || 'Unknown',
        employeeCount: c.employeeCountOcean || 0,
        industry: c.industries && c.industries.length > 0 ? c.industries[0] : '',
      }));

    console.log(`[Ocean.io] Found ${domains.length} lookalike domains`);
    res.json({ domains });
  } catch (err) {
    console.error('[Ocean.io] Request failed:', err);
    res.status(500).json({ error: 'Failed to connect to Ocean.io', details: String(err) });
  }
});
