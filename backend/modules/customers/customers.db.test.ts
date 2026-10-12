import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaCustomersRepository } from "./customers.repository";

test("Prisma persists customer identity and rotates refresh sessions atomically", async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for the database integration test");
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Database tests only run against local PostgreSQL");

  const schema = `delivery_customers_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  const testPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
  let prisma: PrismaClient | undefined;

  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const client = await testPool.connect();
    try {
      const migrationsRoot = resolve("backend/prisma/migrations");
      const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations) {
        await client.query(await readFile(resolve(migrationsRoot, migration, "migration.sql"), "utf8"));
      }
    } finally {
      client.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const repository = new PrismaCustomersRepository(prisma);
    const customer = await repository.create({
      loginName: "joaodasilva",
      name: "João da Silva",
      phone: "+5511987654321",
    });
    assert.equal((await repository.findByPhone(customer.phone!))?.id, customer.id);

    const firstTokenHash = createHash("sha256").update("first-token").digest("hex");
    const secondTokenHash = createHash("sha256").update("second-token").digest("hex");
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + 86_400_000);
    await repository.createSession({ customerId: customer.id, familyId, tokenHash: firstTokenHash, expiresAt });
    const first = await repository.findSessionByTokenHash(firstTokenHash);
    assert.equal(first?.customer.id, customer.id);
    assert.equal(await repository.rotateSession(first!.id, new Date(), {
      customerId: customer.id,
      familyId,
      tokenHash: secondTokenHash,
      expiresAt,
    }), true);
    assert.ok((await repository.findSessionByTokenHash(firstTokenHash))?.revokedAt);
    assert.equal((await repository.findSessionByTokenHash(secondTokenHash))?.revokedAt, null);
    assert.equal(await repository.rotateSession(first!.id, new Date(), {
      customerId: customer.id,
      familyId,
      tokenHash: createHash("sha256").update("third-token").digest("hex"),
      expiresAt,
    }), false);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith("delivery_customers_test_")) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
