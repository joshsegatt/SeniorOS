export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface StackInfo {
  root: string;
  language: string[];
  frameworks: string[];
  packageManager: string | null;
  database: string[];
  auth: string[];
  deployment: string[];
  testFrameworks: string[];
}

export interface RiskSignal {
  code: string;
  points: number;
  reason: string;
  files: string[];
}

export interface RiskReport {
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  gates: string[];
  files: string[];
}

export interface ProofCheck {
  name: string;
  command: string | null;
  status: 'pass' | 'fail' | 'skip';
  exitCode: number | null;
  durationMs: number;
}

export interface ProofReport {
  checks: ProofCheck[];
  baselinePassed: boolean;
  availableChecks: number;
  totalChecks: number;
}
