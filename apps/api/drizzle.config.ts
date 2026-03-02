import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Default matches docker-compose.yml (host port 5433 -> container 5432)
    url: process.env.DATABASE_URL ?? "postgresql://giftops:giftops@localhost:5433/giftops",
  },
});
