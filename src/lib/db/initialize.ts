import { sqlite } from "./client";

let initialized = false;

export function initializeDatabase() {
  if (initialized) return;
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY NOT NULL, school TEXT, education TEXT, roles TEXT, skills TEXT, interests TEXT, weekly_hours INTEGER, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY NOT NULL, platform TEXT NOT NULL, name TEXT NOT NULL, season TEXT, status TEXT NOT NULL, source_url TEXT NOT NULL, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS competition_tracks (id TEXT PRIMARY KEY NOT NULL, competition_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, deadline INTEGER);" +
    "CREATE TABLE IF NOT EXISTS recruitment_projects (id TEXT PRIMARY KEY NOT NULL, creator_id TEXT NOT NULL, competition_id TEXT, track_name TEXT, title TEXT NOT NULL, description TEXT NOT NULL, roles TEXT, weekly_hours INTEGER, status TEXT NOT NULL, created_at INTEGER NOT NULL);",
  );
  initialized = true;
}
