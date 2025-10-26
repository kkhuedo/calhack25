import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Only require DATABASE_URL if you're using DatabaseStorage
// For in-memory storage (development), this is optional
let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });

} else {
  console.log("⚠️  No DATABASE_URL found - using in-memory storage (data will be lost on restart)");
}

export { pool, db };
