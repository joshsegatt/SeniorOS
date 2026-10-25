import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { detectStack } from './detect-stack.js';
import { exists, writeFileIfMissing } from './fs-utils.js';

export async function initProject(root: string): Promise<{ created: string[]; preserved: string[] }> {
  const seniorDir = path.join(root, '.senior');
  await mkdir(seniorDir, { recursive: true });
  const stack = await detectStack(root);
  const created: string[] = [];
  const preserved: string[] = [];

  const projectFile = path.join(seniorDir, 'project.json');
  if (await exists(projectFile)) {
    preserved.push('.senior/project.json');
  } else {
    await writeFile(projectFile, JSON.stringify({ schemaVersion: 1, detectedAt: new Date().toISOString(), stack: { ...stack, root: '.' } }, null, 2) + '\n', 'utf8');
    created.push('.senior/project.json');
  }

  const files: Array<[string, string]> = [
    ['.senior/README.md', `# SeniorOS project state\n\nThis directory stores concise, versionable engineering context.\n\n- \`project.json\`: detected project facts.\n- \`decisions.md\`: durable architectural/engineering decisions.\n- \`work-ledger.jsonl\`: append-only task/ownership events for future orchestration.\n- \`runtime/\`: ephemeral evidence and traces; do not commit.\n\nNever store secrets or raw conversation logs here.\n`],
    ['.senior/decisions.md', '# Engineering decisions\n\nRecord only decisions that should constrain future work. Keep entries short and dated.\n\n'],
    ['.senior/work-ledger.jsonl', '']
  ];

  for (const [relative, content] of files) {
    const wasCreated = await writeFileIfMissing(path.join(root, relative), content);
    (wasCreated ? created : preserved).push(relative);
  }

  return { created, preserved };
}
