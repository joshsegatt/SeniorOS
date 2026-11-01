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
  /** Changed paths excluded by `risk.ignore` in `.senior/config.json`. */
  ignored: string[];
}

export interface ProofCheck {
  name: string;
  command: string | null;
  status: 'pass' | 'fail' | 'skip';
  exitCode: number | null;
  durationMs: number;
  /** Why a check was skipped or failed without a normal exit code. */
  reason?: string;
}

export interface ProofReport {
  /**
   * `config` when checks come from `.senior/config.json`; `standard` when the baseline includes Python, Go or Rust
   * checks; otherwise `package-scripts`.
   */
  source: 'package-scripts' | 'standard' | 'config';
  checks: ProofCheck[];
  baselinePassed: boolean;
  availableChecks: number;
  totalChecks: number;
}
