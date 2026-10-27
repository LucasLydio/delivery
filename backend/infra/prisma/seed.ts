import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  readDemoUserPasswordsFromEnvironment,
  seedDemoUsers,
} from "./seeds/demo-users.seed";
import { seedRestaurantProducts } from "./seeds/restaurant-products.seed";

async function main(): Promise<void> {
  const connectionString = process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required to seed the database");

  // Validate all required seed inputs before writing any data.
  const demoUserPasswords = readDemoUserPasswordsFromEnvironment();
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    await seedRestaurantProducts(client);
    await seedDemoUsers(client, demoUserPasswords);
    console.log("Database seed completed successfully.");
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Database seed failed", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
