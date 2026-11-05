import { sqlite } from "./client";

let initialized = false;

export function initializeDatabase() {
  if (initialized) return;
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY NOT NULL, school TEXT, education TEXT, roles TEXT, skills TEXT, interests TEXT, weekly_hours INTEGER, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY NOT NULL, platform TEXT NOT NULL, name TEXT NOT NULL, season TEXT, status TEXT NOT NULL, source_url TEXT NOT NULL, updated_at INTEGER NOT NULL, review_status TEXT NOT NULL DEFAULT 'approved', reviewed_by TEXT, reviewed_at INTEGER, review_note TEXT);" +
    "CREATE TABLE IF NOT EXISTS competition_tracks (id TEXT PRIMARY KEY NOT NULL, competition_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, deadline INTEGER);" +
    "CREATE TABLE IF NOT EXISTS recruitment_projects (id TEXT PRIMARY KEY NOT NULL, creator_id TEXT NOT NULL, competition_id TEXT, track_name TEXT, title TEXT NOT NULL, description TEXT NOT NULL, roles TEXT, weekly_hours INTEGER, status TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS team_applications (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, applicant_id TEXT NOT NULL, message TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(project_id, applicant_id));" +
    "CREATE TABLE IF NOT EXISTS project_tasks (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, assignee TEXT, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS project_ai_reports (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS admin_audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS password_reset_codes (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);",
  );
  const competitionColumns = sqlite.prepare("PRAGMA table_info(competitions)").all() as Array<{ name: string }>;
  const existingCompetitionColumns = new Set(competitionColumns.map((column) => column.name));
  for (const [name, definition] of [
    ["review_status", "TEXT NOT NULL DEFAULT 'approved'"],
    ["reviewed_by", "TEXT"],
    ["reviewed_at", "INTEGER"],
    ["review_note", "TEXT"],
  ] as const) {
    if (!existingCompetitionColumns.has(name)) sqlite.exec(`ALTER TABLE competitions ADD COLUMN ${name} ${definition}`);
  }
  sqlite.exec("CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at DESC)");
  const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "role")) {
    try {
      sqlite.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    } catch (error) {
      const columnsAfterMigration = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
      if (!columnsAfterMigration.some((column) => column.name === "role")) throw error;
    }
  }
  sqlite.exec("CREATE TABLE IF NOT EXISTS user_avatars (user_id TEXT PRIMARY KEY NOT NULL, content BLOB NOT NULL, content_type TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  initialized = true;
}
