export type PipelineStage = 'sourcing' | 'decision-makers' | 'email-resolution' | 'outreach';

export type StageStatus = 'idle' | 'running' | 'success' | 'error' | 'rate-limited' | 'paused';

export interface StageState {
  id: PipelineStage;
  label: string;
  apiSource: string;
  status: StageStatus;
  progress: number;
  message: string;
  resultCount?: number;
}

export interface Lead {
  id: string;
  company: string;
  domain: string;
  name: string;
  title: string;
  linkedinUrl: string;
  email: string;
  emailStatus: 'verified' | 'unverified' | 'missing' | 'skipped';
}

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export type PageId = 'dashboard' | 'campaigns' | 'api-keys' | 'logs';

export type PipelinePhase =
  | 'idle'
  | 'running'
  | 'checkpoint'
  | 'approved'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ApiErrorInfo {
  message: string;
  stage: PipelineStage;
  retryable: boolean;
}
