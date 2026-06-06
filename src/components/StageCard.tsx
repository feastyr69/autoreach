import {
  Globe,
  Users,
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
} from 'lucide-react';
import type { StageState } from '../types';

const STAGE_ICONS = {
  sourcing: Globe,
  'decision-makers': Users,
  'email-resolution': Mail,
  outreach: Send,
};

interface StageCardProps {
  stage: StageState;
  index: number;
}

export default function StageCard({ stage, index }: StageCardProps) {
  const Icon = STAGE_ICONS[stage.id];

  const statusConfig = {
    idle: {
      border: 'border-zinc-800/60',
      bg: 'bg-zinc-900/40',
      iconBg: 'bg-zinc-800',
      iconColor: 'text-zinc-500',
      glow: '',
    },
    running: {
      border: 'border-violet-500/30',
      bg: 'bg-zinc-900/80',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
      glow: 'shadow-lg shadow-violet-500/10',
    },
    success: {
      border: 'border-emerald-500/30',
      bg: 'bg-zinc-900/80',
      iconBg: 'bg-emerald-500/15',
      iconColor: 'text-emerald-400',
      glow: '',
    },
    error: {
      border: 'border-red-500/30',
      bg: 'bg-zinc-900/80',
      iconBg: 'bg-red-500/15',
      iconColor: 'text-red-400',
      glow: '',
    },
    'rate-limited': {
      border: 'border-amber-500/30',
      bg: 'bg-zinc-900/80',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      glow: 'shadow-lg shadow-amber-500/10',
    },
    paused: {
      border: 'border-amber-500/30',
      bg: 'bg-zinc-900/80',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
      glow: 'shadow-lg shadow-amber-500/5',
    },
  };

  const config = statusConfig[stage.status];

  return (
    <div
      id={`stage-card-${stage.id}`}
      className={`relative rounded-xl border p-5 transition-all duration-500 ${config.border} ${config.bg} ${config.glow}`}
    >
      {/* Stage number badge */}
      <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-bold text-zinc-400">
        {index + 1}
      </div>

      {/* Status indicator badge */}
      {stage.status === 'rate-limited' && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold px-2.5 py-0.5 rounded-full animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          Rate Limited - Retrying
        </div>
      )}

      {stage.status === 'success' && stage.resultCount !== undefined && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          {stage.resultCount} found
        </div>
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg ${config.iconBg} flex items-center justify-center mb-3`}>
        {stage.status === 'running' ? (
          <Loader2 className={`w-5 h-5 ${config.iconColor} animate-spin`} />
        ) : stage.status === 'success' ? (
          <CheckCircle2 className={`w-5 h-5 ${config.iconColor}`} />
        ) : stage.status === 'error' ? (
          <XCircle className={`w-5 h-5 ${config.iconColor}`} />
        ) : stage.status === 'paused' ? (
          <Pause className={`w-5 h-5 ${config.iconColor}`} />
        ) : (
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        )}
      </div>

      {/* Label */}
      <h3 className="text-sm font-semibold text-zinc-200 mb-0.5">{stage.label}</h3>
      <p className="text-[11px] text-zinc-500 font-medium mb-3">via {stage.apiSource}</p>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            stage.status === 'error'
              ? 'bg-red-500'
              : stage.status === 'rate-limited'
              ? 'bg-amber-500'
              : stage.status === 'success'
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-violet-500 to-blue-500'
          }`}
          style={{ width: `${stage.progress}%` }}
        />
      </div>

      {/* Status text */}
      <p
        className={`text-[11px] mt-2 font-medium ${
          stage.status === 'success'
            ? 'text-emerald-400'
            : stage.status === 'error'
            ? 'text-red-400'
            : stage.status === 'rate-limited'
            ? 'text-amber-400'
            : stage.status === 'paused'
            ? 'text-amber-400'
            : 'text-zinc-500'
        }`}
      >
        {stage.message}
      </p>
    </div>
  );
}
