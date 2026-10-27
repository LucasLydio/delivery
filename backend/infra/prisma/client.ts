import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getDatabaseUrl } from "../../config/env";

type PrismaGlobal = typeof globalThis & {
  deliveryPool?: Pool;
  deliveryPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as PrismaGlobal;

export function getPrisma(): PrismaClient {
  if (globalForPrisma.deliveryPrisma) return globalForPrisma.deliveryPrisma;

  const pool = globalForPrisma.deliveryPool ?? new Pool({
    connectionString: getDatabaseUrl(),
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  if (process.env.NODE_ENV !== "production") globalForPrisma.deliveryPool = pool;
  globalForPrisma.deliveryPrisma = prisma;
  return prisma;
}
