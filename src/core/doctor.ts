import path from 'node:path';
import { exists } from './fs-utils.js';
import { detectStack } from './detect-stack.js';

export interface DoctorReport {
  node: string;
  gitRepository: boolean;
  seniorState: boolean;
  hostSkills: Record<string, boolean>;
  stack: Awaited<ReturnType<typeof detectStack>>;
}

export async function doctor(root: string): Promise<DoctorReport> {
  return {
    node: process.version,
    gitRepository: await exists(path.join(root, '.git')),
    seniorState: await exists(path.join(root, '.senior', 'project.json')),
    hostSkills: {
      claude: await exists(path.join(root, '.claude', 'skills', 'senior-engineering', 'SKILL.md')),
      codex: await exists(path.join(root, '.codex', 'skills', 'senior-engineering', 'SKILL.md')),
      generic: await exists(path.join(root, '.agents', 'skills', 'senior-engineering', 'SKILL.md'))
    },
    stack: await detectStack(root)
  };
}
