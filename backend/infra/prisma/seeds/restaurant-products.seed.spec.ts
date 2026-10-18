import assert from "node:assert/strict";
import { test } from "node:test";
import { restaurantCategories, restaurantProducts } from "./restaurant-products.seed";

test("restaurant seed defines three categories with five valid products each", () => {
  assert.deepEqual(restaurantCategories.map((category) => category.slug), [
    "executivos", "bebidas", "acompanhamentos",
  ]);

  const slugs = new Set<string>();
  for (const category of restaurantCategories) {
    const products = restaurantProducts.filter((product) => product.categorySlug === category.slug);
    assert.equal(products.length, 5, `Expected five products in ${category.slug}`);
    for (const product of products) {
      assert.equal(Number.isInteger(product.basePriceMinor) && product.basePriceMinor >= 0, true);
      assert.equal(slugs.has(product.slug), false, `Duplicate product slug: ${product.slug}`);
      slugs.add(product.slug);
    }
  }

  assert.equal(slugs.size, 15);
});
