import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaOrdersRepository } from "./orders.repository";

test("Prisma creates an order snapshot, event, and consumes the cart atomically", async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env");
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for the database integration test");
  const parsed = new URL(databaseUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Database tests only run against local PostgreSQL");
  const schema = `delivery_orders_test_${randomUUID().replaceAll("-", "")}`;
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
    const customer = await prisma.customer.create({ data: { name: "Ana", loginName: "ana", phone: "+5511999999999" } });
    const category = await prisma.category.create({ data: { slug: "pokes", name: "Pokes" } });
    const product = await prisma.product.create({ data: {
      id: "product-order-db", slug: "order-db", name: "Poke", description: "Fresco", categoryId: category.id,
      basePriceMinor: 2500, currency: "BRL",
      optionGroups: { create: { id: "group-order-db", name: "Extras", options: { create: { id: "option-order-db", name: "Abacate", priceDeltaMinor: 300 } } } },
    } });
    await prisma.cart.create({ data: {
      customerId: customer.id, currency: "BRL", items: { create: { id: randomUUID(), productId: product.id, quantity: 1 } },
    } });
    const repository = new PrismaOrdersRepository(prisma);
    const order = await repository.create({
      customerId: customer.id, cartId: (await prisma.cart.findUniqueOrThrow({ where: { customerId: customer.id } })).id,
      idempotencyKey: "db-checkout-1", paymentExpiresAt: new Date("2026-10-12T15:05:00Z"),
      addressSnapshot: { line1: "Rua Um", locationPin: { latitude: -23.55, longitude: -46.63 } },
      quote: {
        kind: "confirmed", cartRevision: "1", currency: "BRL", paymentMethod: "MERCADO_PAGO_PIX",
        lines: [{ itemId: "cart-item", productId: product.id, name: "Poke", quantity: 1,
          selectedOptions: [{ id: "option-order-db", name: "Abacate", priceDeltaMinor: 300 }], unitPriceMinor: 2800, lineTotalMinor: 2800 }],
        subtotalMinor: 2800, deliveryFeeMinor: 0, paymentFeeMinor: 312, discountPercent: 0,
        discountMinor: 0, couponCode: null, distanceMeters: 0, taxMinor: 0, totalMinor: 3112,
        expiresAt: "2026-10-12T15:05:00.000Z",
      },
    });
    assert.equal(order.status, "PAYMENT_PENDING");
    assert.equal(order.lines[0].selectedOptions[0].name, "Abacate");
    assert.equal(await prisma.cart.count({ where: { customerId: customer.id } }), 0);
    assert.equal((await repository.events(customer.id, 0n, 10))[0].type, "order.payment_pending");
    assert.equal((await repository.findByIdempotencyKey(customer.id, "db-checkout-1"))?.id, order.id);
  } finally {
    await prisma?.$disconnect();
    await testPool.end();
    if (schema.startsWith("delivery_orders_test_")) await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});

