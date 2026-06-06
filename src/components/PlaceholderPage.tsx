import { Construction } from 'lucide-react';
import type { PageId } from '../types';

const PAGE_TITLES: Record<Exclude<PageId, 'dashboard'>, string> = {
  campaigns: 'Campaigns',
  'api-keys': 'API Keys Configuration',
  logs: 'System Logs',
};

const PAGE_DESCRIPTIONS: Record<Exclude<PageId, 'dashboard'>, string> = {
  campaigns: 'Manage and track all your outreach campaigns, view delivery stats, and monitor response rates.',
  'api-keys': 'Configure your API credentials for Ocean.io, Prospeo, Eazyreach, and Brevo integrations.',
  logs: 'View historical pipeline logs, audit trails, and system-level diagnostics.',
};

interface PlaceholderPageProps {
  pageId: Exclude<PageId, 'dashboard'>;
}

export default function PlaceholderPage({ pageId }: PlaceholderPageProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mx-auto mb-5">
          <Construction className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-bold text-zinc-200 mb-2">{PAGE_TITLES[pageId]}</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6 leading-relaxed">
          {PAGE_DESCRIPTIONS[pageId]}
        </p>
        <div className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 px-4 py-2 rounded-full text-sm font-medium">
          <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
