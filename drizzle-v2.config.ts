import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/schema-v2.ts",
  out: "./drizzle-v2",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
