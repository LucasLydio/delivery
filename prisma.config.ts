import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({
  path: process.env["PRISMA_ENV_FILE"] ?? ".env.dev",
  override: false,
  quiet: true,
});

export default defineConfig({
  schema: "backend/prisma/schema.prisma",
  migrations: {
    path: "backend/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
