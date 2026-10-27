import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma, type UserProfile } from '@prisma/client';
import { Pool } from 'pg';
import { ScryptPasswordHasher } from '../../../modules/users/users.password';

interface DemoUser {
  name: string;
  email: string;
  profile: UserProfile;
  passwordEnvironmentKey: 'DEMO_ADMIN_PASSWORD' | 'DEMO_MANAGER_PASSWORD';
}

export const demoUsers: readonly DemoUser[] = [
  {
    name: 'Administrador Demonstração',
    email: 'admin@demonstracao.com.br',
    profile: 'ADMIN',
    passwordEnvironmentKey: 'DEMO_ADMIN_PASSWORD',
  },
  {
    name: 'Gerente Demonstração',
    email: 'gerente@demonstracao.com.br',
    profile: 'MANAGER',
    passwordEnvironmentKey: 'DEMO_MANAGER_PASSWORD',
  },
];

export function readDemoUserPasswordsFromEnvironment(): Map<string, string> {
  const passwords = new Map<string, string>();
  for (const user of demoUsers) {
    const password = process.env[user.passwordEnvironmentKey];
    if (!password || password.length < 8) {
      throw new Error(`${user.passwordEnvironmentKey} must contain at least 8 characters`);
    }
    passwords.set(user.email, password);
  }
  return passwords;
}

export async function seedDemoUsers(
  client: PrismaClient,
  passwords: ReadonlyMap<string, string>,
): Promise<void> {
  const passwordHasher = new ScryptPasswordHasher();
  const usersWithHashes = await Promise.all(
    demoUsers.map(async (user) => {
      const password = passwords.get(user.email);
      if (!password) throw new Error(`Password missing for ${user.email}`);
      return { ...user, passwordHash: await passwordHasher.hash(password) };
    }),
  );

  await client.$transaction(async (transaction: Prisma.TransactionClient) => {
    for (const { passwordEnvironmentKey: _passwordEnvironmentKey, ...user } of usersWithHashes) {
      const saved = await transaction.user.upsert({
        where: { email: user.email },
        create: user,
        update: {
          name: user.name,
          profile: user.profile,
          passwordHash: user.passwordHash,
        },
        select: { id: true },
      });
      await transaction.userSession.deleteMany({ where: { userId: saved.id } });
    }
  });
}

async function main(): Promise<void> {
  const connectionString = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
  if (!connectionString)
    throw new Error('DIRECT_URL or DATABASE_URL is required to seed demo users');

  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await seedDemoUsers(client, readDemoUserPasswordsFromEnvironment());
    console.log(`Demo user seed completed: ${demoUsers.length} users.`);
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      'Demo user seed failed',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
  });
}
