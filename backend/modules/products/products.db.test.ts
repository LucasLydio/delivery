import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaProductsRepository } from "./products.repository";

test("Prisma reads the migrated catalog tables and nested product data", async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for the database integration test");
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Database tests only run against local PostgreSQL");

  const schema = `delivery_products_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  const testPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 2_000 });
  let prisma: PrismaClient | undefined;

  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const client = await testPool.connect();
    try {
      const currentSchema = await client.query<{ current_schema: string }>("SELECT current_schema()");
      assert.equal(currentSchema.rows[0].current_schema, schema, "Test connection must use the temporary schema");
      for (const migration of ["20261011000000_init", "20261011000001_commerce_models"]) {
        const sql = await readFile(resolve("backend/prisma/migrations", migration, "migration.sql"), "utf8");
        await client.query(sql);
      }
    } finally {
      client.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const category = await prisma.category.create({ data: { slug: "pratos", name: "Pratos" } });
    await prisma.product.create({
      data: {
        id: "db-product-1", slug: "poke", name: "Poke", description: "Fresco",
        categoryId: category.id, basePriceMinor: 2590, currency: "BRL",
        images: { create: { storageKey: "menu/poke.webp", alt: "Poke", mimeType: "image/webp" } },
        optionGroups: { create: {
          name: "Extras", minSelections: 0, maxSelections: 1,
          options: { create: { name: "Abacate", priceDeltaMinor: 350 } },
        } },
      },
    });

    const repository = new PrismaProductsRepository(prisma);
    const isolatedRows = await testPool.query<{ count: string }>("SELECT count(*) FROM categories WHERE slug = 'pratos'");
    assert.equal(isolatedRows.rows[0].count, "1", "Prisma writes must stay inside the temporary schema");
    assert.equal(await repository.version(), 1);
    const products = await repository.list();
    assert.equal(products.length, 1);
    assert.equal(products[0].category.name, "Pratos");
    assert.equal(products[0].images[0].storageKey, "menu/poke.webp");
    assert.equal(products[0].optionGroups[0].options[0].priceDeltaMinor, 350);
    assert.equal((await repository.findById("db-product-1"))?.name, "Poke");
    assert.equal((await repository.list({ query: "Pratos" })).length, 1);
    assert.equal(await repository.findById("missing"), null);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith("delivery_products_test_")) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
