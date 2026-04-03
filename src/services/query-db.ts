import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/query-client";

const globalForQueryPrisma = globalThis as unknown as {
  queryPrisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_QUERY_URL;

if (!connectionString) {
  throw new Error("DATABASE_QUERY_URL is not defined");
}

// Prisma 7 requires explicit connection pool / adapters for native drivers
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const queryPrisma =
  globalForQueryPrisma.queryPrisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForQueryPrisma.queryPrisma = queryPrisma;
}
