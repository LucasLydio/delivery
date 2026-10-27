import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaProductsRepository } from './products.repository';

test('Prisma reads the migrated catalog tables and nested product data', async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'DATABASE_URL is required for the database integration test');
  const parsed = new URL(databaseUrl);
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname),
    'Database tests only run against local PostgreSQL',
  );

  const schema = `delivery_products_test_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  const testPool = new Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema}`,
    connectionTimeoutMillis: 2_000,
  });
  let prisma: PrismaClient | undefined;

  try {
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const client = await testPool.connect();
    try {
      const currentSchema = await client.query<{ current_schema: string }>(
        'SELECT current_schema()',
      );
      assert.equal(
        currentSchema.rows[0].current_schema,
        schema,
        'Test connection must use the temporary schema',
      );
      const root = resolve('backend/prisma/migrations');
      for (const migration of (await readdir(root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()) {
        await client.query(await readFile(resolve(root, migration, 'migration.sql'), 'utf8'));
      }
    } finally {
      client.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const category = await prisma.category.create({ data: { slug: 'pratos', name: 'Pratos' } });
    await prisma.product.create({
      data: {
        id: 'db-product-1',
        slug: 'poke',
        name: 'Poke',
        description: 'Fresco',
        categoryId: category.id,
        basePriceMinor: 2590,
        currency: 'BRL',
        images: { create: { storageKey: 'menu/poke.webp', alt: 'Poke', mimeType: 'image/webp' } },
        optionGroups: {
          create: {
            name: 'Extras',
            minSelections: 0,
            maxSelections: 1,
            options: { create: { name: 'Abacate', priceDeltaMinor: 350 } },
          },
        },
      },
    });

    const repository = new PrismaProductsRepository(prisma);
    const isolatedRows = await testPool.query<{ count: string }>(
      "SELECT count(*) FROM categories WHERE slug = 'pratos'",
    );
    assert.equal(
      isolatedRows.rows[0].count,
      '1',
      'Prisma writes must stay inside the temporary schema',
    );
    assert.equal(await repository.version(), 1);
    const products = await repository.list();
    assert.equal(products.length, 1);
    assert.equal(products[0].category.name, 'Pratos');
    assert.equal(products[0].images[0].storageKey, 'menu/poke.webp');
    assert.equal(products[0].optionGroups[0].options[0].priceDeltaMinor, 350);
    assert.equal((await repository.findById('db-product-1'))?.name, 'Poke');
    assert.equal((await repository.list({ query: 'Pratos' })).length, 1);
    assert.equal(await repository.findById('missing'), null);
    const created = await repository.create({
      name: 'Sopa',
      description: 'Quente',
      categoryId: category.id,
      basePriceMinor: 1800,
      sortOrder: 20,
      slug: 'sopa',
      currency: 'BRL',
    });
    const withGroup = await repository.createOptionGroup(created.id, {
      name: 'Tamanho',
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 10,
    });
    const groupId = withGroup!.optionGroups[0].id;
    const withOption = await repository.createOption(groupId, {
      name: 'Grande',
      priceDeltaMinor: 500,
      sortOrder: 10,
    });
    const optionId = withOption!.optionGroups[0].options[0].id;
    assert.equal(
      (await repository.updateOption(optionId, { available: false }))?.optionGroups[0].options[0]
        .available,
      false,
    );
    assert.equal((await repository.update(created.id, { available: false }))?.available, false);
    assert.equal(await repository.findById(created.id), null);
    assert.equal((await repository.findByIdForAdmin(created.id))?.available, false);
    assert.equal(await repository.version(), 6);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith('delivery_products_test_'))
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
