import assert from "node:assert/strict";
import { test } from "node:test";
import { ProductsService, productImageUrl, toCatalogProduct } from "./products.service";
import { MemoryCache, MemoryProductsRepository, productFixture } from "./products.fixtures";

test("maps the persisted product, options, and image key to the shared wire contract", () => {
  const product = toCatalogProduct(productFixture(), "/images/products/");
  assert.equal(product.basePriceMinor, 2590);
  assert.equal(product.categoryName, "Pratos");
  assert.deepEqual(product.images[0], {
    key: "menu/poke 1.webp", url: "/images/products/menu/poke%201.webp",
    alt: "Poke", width: 640, height: 640,
  });
  assert.deepEqual(product.optionGroups[0].options[0], {
    id: "option-1", name: "Abacate", priceDeltaMinor: 350, available: true,
  });
  assert.equal(productImageUrl("https://example.test/bucket", "menu/poke.webp"), "https://example.test/bucket/menu/poke.webp");
});

test("uses cached snapshots until the database revision changes", async () => {
  const repository = new MemoryProductsRepository();
  const cache = new MemoryCache();
  const service = new ProductsService(repository, cache, "BRL", "/images/products/", "test", () => new Date("2026-10-12T00:00:00.000Z"));

  const first = await service.list(await service.version());
  const second = await service.list(await service.version());
  assert.deepEqual(second, first);
  assert.equal(repository.listCalls, 1);
  assert.equal(first.fetchedAt, "2026-10-12T00:00:00.000Z");
  assert.equal(cache.ttl.get("test:catalog:v1:products:all"), 300);

  repository.revision = 2;
  repository.rows[0].basePriceMinor = 2790;
  const updated = await service.list(await service.version());
  assert.equal(updated.version, "2");
  assert.equal(updated.products[0].basePriceMinor, 2790);
  assert.equal(repository.listCalls, 2);
});

test("rejects a catalog with prices in a different currency", async () => {
  const repository = new MemoryProductsRepository();
  repository.rows[0].currency = "USD";
  const service = new ProductsService(repository, new MemoryCache(), "BRL", "/images/products/", "test");
  await assert.rejects(service.list(1), /currency/);
  await assert.rejects(service.findById("product-1", 1), /currency/);
});
