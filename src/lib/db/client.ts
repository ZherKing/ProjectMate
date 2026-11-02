import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.replace("file:", "") ?? "database.sqlite";
export const sqlite = new Database(databaseUrl);

export const db = drizzle(sqlite, { schema });
