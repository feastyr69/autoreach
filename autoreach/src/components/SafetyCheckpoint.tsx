import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Rocket,
  Ban,
} from 'lucide-react';
import type { Lead } from '../types';

interface SafetyCheckpointProps {
  leads: Lead[];
  onApprove: () => void;
  onCancel: () => void;
}

const EMAIL_STATUS_CONFIG = {
  verified: {
    label: 'Verified',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  unverified: {
    label: 'Unverified',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  missing: {
    label: 'Missing Email',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  skipped: {
    label: 'Skipped',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  },
};

export default function SafetyCheckpoint({
  leads,
  onApprove,
  onCancel,
}: SafetyCheckpointProps) {
  const verified = leads.filter((l) => l.emailStatus === 'verified').length;
  const unverified = leads.filter((l) => l.emailStatus === 'unverified').length;
  const missing = leads.filter((l) => l.emailStatus === 'missing' || l.emailStatus === 'skipped').length;

  return (
    <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl p-6 backdrop-blur-sm animate-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">Safety Checkpoint</h2>
            <p className="text-xs text-zinc-500">Review discovered leads before firing outreach</p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {verified} verified
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full">
            {unverified} unverified
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full">
            <XCircle className="w-3.5 h-3.5" />
            {missing} missing
          </span>
        </div>
      </div>

      {/* Data table */}
      <div className="border border-zinc-800/60 rounded-xl overflow-hidden mb-5">
        <table className="w-full text-sm" id="leads-table">
          <thead>
            <tr className="bg-zinc-800/50 border-b border-zinc-800/60">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Executive</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Title</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">LinkedIn</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => {
              const statusCfg = EMAIL_STATUS_CONFIG[lead.emailStatus];
              return (
                <tr
                  key={lead.id}
                  className={`border-b border-zinc-800/40 transition-colors hover:bg-zinc-800/30 ${
                    i % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-900/20'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase">
                        {lead.company[0]}
                      </div>
                      <div>
                        <span className="text-zinc-200 font-medium text-[13px]">{lead.company}</span>
                        <span className="block text-[11px] text-zinc-500">{lead.domain}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 font-medium text-[13px]">{lead.name}</td>
                  <td className="px-4 py-3 text-zinc-400 text-[13px]">{lead.title}</td>
                  <td className="px-4 py-3">
                    <a
                      href={lead.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                    >
                      Profile
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[13px] ${
                        lead.emailStatus === 'missing' || lead.emailStatus === 'skipped'
                          ? 'text-zinc-600 line-through italic'
                          : 'text-zinc-300'
                      }`}
                    >
                      {lead.email || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          id="cancel-run-btn"
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Ban className="w-4 h-4" />
          Cancel Run
        </button>
        <button
          id="approve-campaign-btn"
          onClick={onApprove}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Rocket className="w-4 h-4" />
          Approve & Fire Campaign
        </button>
      </div>
    </div>
  );
}
