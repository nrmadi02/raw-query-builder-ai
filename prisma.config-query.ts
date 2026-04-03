// Prisma config for query database (remote)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema-query.prisma",
  datasource: {
    url: process.env["DATABASE_QUERY_URL"],
  },
});
