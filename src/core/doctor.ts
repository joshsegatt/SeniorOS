import path from 'node:path';
import { exists } from './fs-utils.js';
import { detectStack } from './detect-stack.js';
import { loadConfig } from './config.js';
import { defaultEnvironment, detectHosts, onPath, type HostEnvironment, type HostStatus } from './hosts.js';

export interface DoctorReport {
  node: string;
  gitRepository: boolean;
  seniorState: boolean;
  /** `none`, `valid`, or `invalid: <reason>` for `.senior/config.json`. */
  config: string;
  hostSkills: Record<string, boolean>;
  /** Each supported host on this machine and whether SeniorOS is set up in it. */
  hosts: HostStatus[];
  /** The finish gate runs `senior finish`; without the CLI on PATH it falls back to `npx senioros`. */
  cliOnPath: boolean;
  stack: Awaited<ReturnType<typeof detectStack>>;
}

async function configStatus(root: string): Promise<string> {
  try {
    return (await loadConfig(root)) ? 'valid' : 'none';
  } catch (error) {
    return `invalid: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function doctor(root: string, e: HostEnvironment = defaultEnvironment(root)): Promise<DoctorReport> {
  return {
    node: process.version,
    gitRepository: await exists(path.join(root, '.git')),
    seniorState: await exists(path.join(root, '.senior', 'project.json')),
    config: await configStatus(root),
    hostSkills: {
      claude: await exists(path.join(root, '.claude', 'skills', 'senior-engineering', 'SKILL.md')),
      codex: await exists(path.join(root, '.codex', 'skills', 'senior-engineering', 'SKILL.md')),
      generic: await exists(path.join(root, '.agents', 'skills', 'senior-engineering', 'SKILL.md'))
    },
    hosts: detectHosts(root, e),
    cliOnPath: onPath('senior', e.env) !== null,
    stack: await detectStack(root)
  };
}
