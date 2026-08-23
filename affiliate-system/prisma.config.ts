import "dotenv/config";
import path from "path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // STAGING_DATABASE_URL routes CLI tooling at the PostgreSQL staging DB;
    // absent (production) behavior is unchanged.
    url:
      process.env.STAGING_DATABASE_URL ||
      process.env.DATABASE_URL ||
      `file:${path.join(__dirname, "prisma", "dev.db")}`,
  },
});
