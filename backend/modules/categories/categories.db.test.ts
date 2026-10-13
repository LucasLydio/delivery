import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaCategoriesRepository } from "./categories.repository";

test("Prisma lists categories in display order and counts only available products", async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for the database integration test");
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Database tests only run against local PostgreSQL");
  const schema = `delivery_categories_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  const testPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
  let prisma: PrismaClient | undefined;
  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const client = await testPool.connect();
    try {
      const root = resolve("backend/prisma/migrations");
      for (const migration of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
        await client.query(await readFile(resolve(root, migration, "migration.sql"), "utf8"));
      }
    } finally { client.release(); }
    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const drinks = await prisma.category.create({ data: { slug: "bebidas", name: "Bebidas", sortOrder: 2 } });
    const meals = await prisma.category.create({ data: { slug: "pratos", name: "Pratos", sortOrder: 1 } });
    await prisma.product.createMany({ data: [
      { slug: "poke", name: "Poke", description: "Fresco", categoryId: meals.id, basePriceMinor: 2500, currency: "BRL", available: true },
      { slug: "sopa", name: "Sopa", description: "Quente", categoryId: meals.id, basePriceMinor: 1800, currency: "BRL", available: false },
    ] });
    const repository = new PrismaCategoriesRepository(prisma);
    const rows = await repository.list();
    assert.deepEqual(rows.map((row) => row.id), [meals.id, drinks.id]);
    assert.equal(rows[0]._count.products, 1);
    assert.equal((await repository.findById(drinks.id))?.slug, "bebidas");
    assert.equal(await repository.findById("missing"), null);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith("delivery_categories_test_")) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});

