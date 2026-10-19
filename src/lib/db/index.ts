import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export function createDb(url: string) {
  const client = postgres(url, { max: 5 });
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
}

export type Database = ReturnType<typeof createDb>["db"];

// Reuse one pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { shopDb?: Database };

export function getDb(): Database {
  if (!globalForDb.shopDb) {
    globalForDb.shopDb = createDb(getEnv().DATABASE_URL).db;
  }
  return globalForDb.shopDb;
}
