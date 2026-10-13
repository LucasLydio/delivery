import assert from "node:assert/strict";
import { test } from "node:test";
import { createProductStorage } from "./storage";

test("local product storage resolves browser URLs and exposes its development directory", () => {
  const storage = createProductStorage({
    STORAGE_PROVIDER: "local",
    PRODUCT_IMAGE_BASE_URL: "/images/products",
    LOCAL_PRODUCT_IMAGE_DIRECTORY: "public/images/products",
  });
  assert.equal(storage.provider, "local");
  assert.equal(storage.localDirectory, "public/images/products");
  assert.equal(storage.publicUrl("menu/poke 1.webp"), "/images/products/menu/poke%201.webp");
});

test("Supabase product storage derives URLs for its configured public bucket", () => {
  const storage = createProductStorage({
    STORAGE_PROVIDER: "supabase",
    PRODUCT_IMAGE_BASE_URL: "/unused/",
    LOCAL_PRODUCT_IMAGE_DIRECTORY: "public/images/products",
    SUPABASE_URL: "https://project.supabase.co/",
    SUPABASE_STORAGE_BUCKET: "product-images",
  });
  assert.equal(storage.provider, "supabase");
  assert.equal(storage.localDirectory, null);
  assert.equal(storage.bucket, "product-images");
  assert.equal(
    storage.publicUrl("brand/menu/poke.webp"),
    "https://project.supabase.co/storage/v1/object/public/product-images/brand/menu/poke.webp",
  );
});

test("Supabase selection fails clearly when its URL or bucket is missing", () => {
  assert.throws(() => createProductStorage({
    STORAGE_PROVIDER: "supabase",
    PRODUCT_IMAGE_BASE_URL: "/unused/",
    LOCAL_PRODUCT_IMAGE_DIRECTORY: "public/images/products",
  }), /Supabase product storage is not configured/);
  const local = createProductStorage({
    STORAGE_PROVIDER: "local", PRODUCT_IMAGE_BASE_URL: "/images/products/", LOCAL_PRODUCT_IMAGE_DIRECTORY: "public/images/products",
  });
  assert.throws(() => local.publicUrl("../secret.webp"), /Invalid product storage key/);
});

