import path from 'node:path';
import { exists, readJson } from './fs-utils.js';
import type { StackInfo } from '../types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function has(deps: Record<string, string>, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(deps, name);
}

export async function detectStack(root: string): Promise<StackInfo> {
  const pkg = await readJson<PackageJson>(path.join(root, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };

  const language: string[] = [];
  const frameworks: string[] = [];
  const database: string[] = [];
  const auth: string[] = [];
  const deployment: string[] = [];
  const testFrameworks: string[] = [];

  if (await exists(path.join(root, 'tsconfig.json')) || has(deps, 'typescript')) language.push('TypeScript');
  if (pkg) language.push('JavaScript/Node.js');
  if (await exists(path.join(root, 'pyproject.toml')) || await exists(path.join(root, 'requirements.txt'))) language.push('Python');
  if (await exists(path.join(root, 'go.mod'))) language.push('Go');
  if (await exists(path.join(root, 'Cargo.toml'))) language.push('Rust');

  if (has(deps, 'next')) frameworks.push('Next.js');
  if (has(deps, 'react')) frameworks.push('React');
  if (has(deps, 'vue')) frameworks.push('Vue');
  if (has(deps, 'svelte')) frameworks.push('Svelte');
  if (has(deps, 'express')) frameworks.push('Express');
  if (has(deps, 'fastify')) frameworks.push('Fastify');
  if (has(deps, '@nestjs/core')) frameworks.push('NestJS');

  if (has(deps, 'drizzle-orm')) database.push('Drizzle');
  if (has(deps, '@prisma/client') || has(deps, 'prisma')) database.push('Prisma');
  if (has(deps, '@supabase/supabase-js')) database.push('Supabase');
  if (has(deps, 'pg')) database.push('PostgreSQL');
  if (has(deps, 'mysql2')) database.push('MySQL');
  if (has(deps, 'mongoose')) database.push('MongoDB/Mongoose');

  if (has(deps, 'better-auth')) auth.push('Better Auth');
  if (has(deps, 'next-auth')) auth.push('Auth.js/NextAuth');
  if (has(deps, '@clerk/nextjs') || has(deps, '@clerk/clerk-react')) auth.push('Clerk');
  if (has(deps, '@supabase/ssr') || has(deps, '@supabase/auth-helpers-nextjs')) auth.push('Supabase Auth');

  if (await exists(path.join(root, 'vercel.json')) || has(deps, '@vercel/node')) deployment.push('Vercel');
  if (await exists(path.join(root, 'wrangler.toml')) || await exists(path.join(root, 'wrangler.jsonc'))) deployment.push('Cloudflare');
  if (await exists(path.join(root, 'Dockerfile')) || await exists(path.join(root, 'docker-compose.yml'))) deployment.push('Docker');
  if (await exists(path.join(root, 'terraform')) || await exists(path.join(root, 'main.tf'))) deployment.push('Terraform');

  if (has(deps, 'vitest')) testFrameworks.push('Vitest');
  if (has(deps, 'jest')) testFrameworks.push('Jest');
  if (has(deps, '@playwright/test')) testFrameworks.push('Playwright');
  if (has(deps, 'cypress')) testFrameworks.push('Cypress');

  let packageManager: string | null = null;
  if (await exists(path.join(root, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (await exists(path.join(root, 'yarn.lock'))) packageManager = 'yarn';
  else if (await exists(path.join(root, 'bun.lockb')) || await exists(path.join(root, 'bun.lock'))) packageManager = 'bun';
  else if (await exists(path.join(root, 'package-lock.json'))) packageManager = 'npm';
  else if (pkg) packageManager = 'npm';

  return {
    root,
    language: [...new Set(language)],
    frameworks: [...new Set(frameworks)],
    packageManager,
    database: [...new Set(database)],
    auth: [...new Set(auth)],
    deployment: [...new Set(deployment)],
    testFrameworks: [...new Set(testFrameworks)]
  };
}
