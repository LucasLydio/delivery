import { ServiceUnavailableException } from "../shared/exceptions";
import { getRuntimeConfig } from "./env";

export type StorageProvider = "local" | "supabase";

export interface ProductStorage {
  provider: StorageProvider;
  publicBaseUrl: string;
  /** Available only for local development writes and seed tooling. */
  localDirectory: string | null;
  bucket: string | null;
  publicUrl(storageKey: string): string;
}

export interface StorageEnvironment {
  STORAGE_PROVIDER: StorageProvider;
  PRODUCT_IMAGE_BASE_URL: string;
  LOCAL_PRODUCT_IMAGE_DIRECTORY: string;
  SUPABASE_URL?: string;
  SUPABASE_STORAGE_BUCKET?: string;
}

function trailingSlash(value: string): string { return value.endsWith("/") ? value : `${value}/`; }

function encodeStorageKey(storageKey: string): string {
  const segments = storageKey.split("/");
  if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))) {
    throw new Error("Invalid product storage key");
  }
  return segments.map(encodeURIComponent).join("/");
}

export function createProductStorage(environment: StorageEnvironment): ProductStorage {
  if (environment.STORAGE_PROVIDER === "supabase") {
    if (!environment.SUPABASE_URL || !environment.SUPABASE_STORAGE_BUCKET) {
      throw new ServiceUnavailableException("Supabase product storage is not configured");
    }
    const projectUrl = environment.SUPABASE_URL.replace(/\/+$/, "");
    const bucket = environment.SUPABASE_STORAGE_BUCKET;
    const publicBaseUrl = `${projectUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    return {
      provider: "supabase",
      publicBaseUrl,
      localDirectory: null,
      bucket,
      publicUrl: (storageKey) => `${publicBaseUrl}${encodeStorageKey(storageKey)}`,
    };
  }

  const publicBaseUrl = trailingSlash(environment.PRODUCT_IMAGE_BASE_URL);
  return {
    provider: "local",
    publicBaseUrl,
    localDirectory: environment.LOCAL_PRODUCT_IMAGE_DIRECTORY,
    bucket: null,
    publicUrl: (storageKey) => `${publicBaseUrl}${encodeStorageKey(storageKey)}`,
  };
}

export function getProductStorage(): ProductStorage {
  return createProductStorage(getRuntimeConfig());
}

