import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaAddressesRepository } from "./addresses.repository";

test("Prisma stores location pins and preserves one default address per customer", async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for the database integration test");
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Database tests only run against local PostgreSQL");

  const schema = `delivery_addresses_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  const testPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
  let prisma: PrismaClient | undefined;

  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const client = await testPool.connect();
    try {
      const root = resolve("backend/prisma/migrations");
      const migrations = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
      for (const migration of migrations) await client.query(await readFile(resolve(root, migration, "migration.sql"), "utf8"));
    } finally {
      client.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const customer = await prisma.customer.create({ data: { name: "Ana Lima", loginName: "analima", phone: "+5511999999999" } });
    const repository = new PrismaAddressesRepository(prisma);
    const common = {
      line1: "Rua A, 10", line2: null, city: "São Paulo", region: "SP", postalCode: "01001000",
      countryCode: "BR", deliveryInstructions: null, locationPin: { latitude: -23.55, longitude: -46.63, accuracyMeters: 8 },
    };
    const home = await repository.create(customer.id, { ...common, label: "Casa" }, false);
    const work = await repository.create(customer.id, { ...common, label: "Trabalho" }, true);
    assert.deepEqual(work.locationPin, common.locationPin);
    assert.equal((await repository.list(customer.id)).filter((address) => address.isDefault).length, 1);
    assert.equal((await repository.list(customer.id))[0].id, work.id);

    assert.equal(await repository.delete(customer.id, work.id), true);
    assert.equal((await repository.list(customer.id))[0].id, home.id);
    assert.equal((await repository.list(customer.id))[0].isDefault, true);
    assert.equal(await repository.update("another-customer", home.id, { label: "No" }), null);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith("delivery_addresses_test_")) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
