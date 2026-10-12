import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../../app";
import { ProductsService } from "./products.service";
import { MemoryCache, MemoryProductsRepository } from "./products.fixtures";

function setup() {
  const repository = new MemoryProductsRepository();
  const cache = new MemoryCache();
  const productsService = new ProductsService(repository, cache, "BRL", "/images/products/", "api-test");
  return { repository, api: request(createApp({ productsService })) };
}

test("GET /api/products returns a catalog snapshot and supports conditional requests", async () => {
  const { repository, api } = setup();
  const first = await api.get("/api/products").expect(200).expect("content-type", /json/);
  assert.equal(first.headers["etag"], '"catalog-1-all"');
  assert.equal(first.body.products[0].basePriceMinor, 2590);

  await api.get("/api/products").set("if-none-match", '"catalog-1-all"').expect(304).expect("");
  assert.equal(repository.listCalls, 1);

  repository.revision = 2;
  await api.get("/api/products").set("if-none-match", '"catalog-1-all"').expect(200).expect("etag", '"catalog-2-all"');
  assert.equal(repository.listCalls, 2);
});

test("GET /api/products supports normalized reusable search criteria", async () => {
  const { repository, api } = setup();
  await api.get("/api/products?q=%20poke%20%20fresco%20").expect(200).expect("etag", '"catalog-1-q:poke%20fresco"');
  assert.deepEqual(repository.lastCriteria, { query: "poke fresco" });
  await api.get(`/api/products?q=${"x".repeat(81)}`).expect(400);
});

test("GET /api/products/:id returns options, caches details, and reports bad or missing IDs", async () => {
  const { repository, api } = setup();
  const first = await api.get("/api/products/product-1").expect(200);
  assert.equal(first.body.optionGroups[0].options[0].priceDeltaMinor, 350);

  await api.get("/api/products/product-1").set("if-none-match", '"product-product-1-1"').expect(304);
  assert.equal(repository.detailCalls, 1);

  repository.revision = 2;
  repository.rows[0].basePriceMinor = 2790;
  const updated = await api.get("/api/products/product-1").set("if-none-match", '"product-product-1-1"').expect(200);
  assert.equal(updated.body.basePriceMinor, 2790);
  assert.equal(repository.detailCalls, 2);

  await api.get("/api/products/invalid%20id").expect(400);
  await api.get("/api/products/missing").expect(404, { error: "Product not found" });
});

test("Express applies global health, not-found, CORS, request ID, and OPTIONS behavior", async () => {
  const { api } = setup();
  await api.get("/api/health").expect(200, { status: "ok" }).expect("x-request-id", /.+/);
  await api.get("/api/config/push-key").expect(200, { enabled: false, publicKey: null });
  await api.get("/api/unknown").expect(404, { error: "Not found" });
  await api.options("/api/products").set("origin", "http://localhost:4200").expect(204).expect("access-control-allow-origin", "http://localhost:4200");
  await api.get("/api/health").set("origin", "https://blocked.example").expect(403, { error: "Origin not allowed" });
});
