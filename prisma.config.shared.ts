import { config as loadEnvironment } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

export type PrismaTarget = 'injected' | 'development' | 'production';

const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

function loadTargetEnvironment(target: Exclude<PrismaTarget, 'injected'>): void {
  const environmentFile = target === 'development' ? '.env.dev' : '.env';
  const result = loadEnvironment({
    path: environmentFile,
    override: true,
    quiet: true,
  });
  if (result.error) {
    throw new Error(`Could not load ${environmentFile}`, { cause: result.error });
  }
}

function validateTarget(target: PrismaTarget, databaseUrl: string, directUrl: string): void {
  if (target === 'injected') return;
  const hosts = [new URL(databaseUrl).hostname, new URL(directUrl).hostname];
  const everyHostIsLocal = hosts.every((hostname) => localHosts.has(hostname));
  const someHostIsLocal = hosts.some((hostname) => localHosts.has(hostname));

  if (target === 'development' && !everyHostIsLocal) {
    throw new Error('Development Prisma commands require a local database');
  }
  if (target === 'production' && someHostIsLocal) {
    throw new Error('Production Prisma commands cannot use a local database');
  }
}

export function createPrismaConfig(target: PrismaTarget) {
  if (target !== 'injected') loadTargetEnvironment(target);

  const databaseUrl = env('DATABASE_URL');
  const directUrl = env('DIRECT_URL');
  validateTarget(target, databaseUrl, directUrl);

  return defineConfig({
    schema: 'backend/prisma/schema.prisma',
    migrations: {
      path: 'backend/prisma/migrations',
      seed: 'node --import tsx backend/infra/prisma/seed.ts',
    },
    datasource: {
      url: databaseUrl,
      directUrl,
    },
  });
}
