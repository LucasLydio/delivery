import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaCartsRepository } from './carts.repository';
import { CartsService } from './carts.service';

test('Prisma replaces nested cart items atomically and enforces revisions', async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env');
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, 'DATABASE_URL is required for the database integration test');
  const parsed = new URL(databaseUrl);
  assert.ok(
    ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname),
    'Database tests only run against local PostgreSQL',
  );

  const schema = `delivery_carts_test_${randomUUID().replaceAll('-', '')}`;
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
      const root = resolve('backend/prisma/migrations');
      const migrations = (await readdir(root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const migration of migrations)
        await client.query(await readFile(resolve(root, migration, 'migration.sql'), 'utf8'));
    } finally {
      client.release();
    }

    prisma = new PrismaClient({ adapter: new PrismaPg(testPool, { schema }) });
    const customer = await prisma.customer.create({
      data: { name: 'Ana', loginName: 'ana', phone: '+5511999999999' },
    });
    const category = await prisma.category.create({ data: { slug: 'pokes', name: 'Pokes' } });
    const product = await prisma.product.create({
      data: {
        id: 'product-db',
        slug: 'poke-db',
        name: 'Poke',
        description: 'Poke fresco',
        categoryId: category.id,
        basePriceMinor: 2500,
        currency: 'BRL',
        optionGroups: {
          create: {
            id: 'group-db',
            name: 'Extras',
            minSelections: 0,
            maxSelections: 1,
            options: { create: { id: 'option-db', name: 'Abacate', priceDeltaMinor: 300 } },
          },
        },
      },
    });
    const repository = new PrismaCartsRepository(prisma);
    const service = new CartsService(
      repository,
      'BRL',
      0,
      300,
      () => new Date('2026-10-12T15:00:00Z'),
    );
    const itemId = randomUUID();
    const first = await service.synchronize(customer.id, {
      revision: null,
      items: [{ id: itemId, productId: product.id, quantity: 2, selectedOptionIds: ['option-db'] }],
    });
    assert.equal(first.revision, '1');
    assert.deepEqual((await repository.find(customer.id))?.items[0].selectedOptionIds, [
      'option-db',
    ]);

    const second = await service.synchronize(customer.id, {
      revision: '1',
      items: [{ id: itemId, productId: product.id, quantity: 3, selectedOptionIds: ['option-db'] }],
    });
    assert.equal(second.revision, '2');
    assert.equal((await repository.find(customer.id))?.items[0].quantity, 3);
    await assert.rejects(
      () => service.synchronize(customer.id, { revision: '1', items: [] }),
      /Cart revision conflict/,
    );
    const quote = await service.quote(customer.id);
    assert.equal(quote.subtotalMinor, 8400);
    assert.equal(quote.totalMinor, 8400);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith('delivery_carts_test_'))
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
