import { sqlite } from "./client";

let initialized = false;

export function initializeDatabase() {
  if (initialized) return;
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, name TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', two_factor_enabled INTEGER NOT NULL DEFAULT 0, two_factor_secret TEXT, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY NOT NULL, school TEXT, education TEXT, roles TEXT, skills TEXT, interests TEXT, weekly_hours INTEGER, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS competitions (id TEXT PRIMARY KEY NOT NULL, platform TEXT NOT NULL, name TEXT NOT NULL, season TEXT, status TEXT NOT NULL, source_url TEXT NOT NULL, updated_at INTEGER NOT NULL, review_status TEXT NOT NULL DEFAULT 'approved', reviewed_by TEXT, reviewed_at INTEGER, review_note TEXT);" +
    "CREATE TABLE IF NOT EXISTS competition_tracks (id TEXT PRIMARY KEY NOT NULL, competition_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, deadline INTEGER);" +
    "CREATE TABLE IF NOT EXISTS recruitment_projects (id TEXT PRIMARY KEY NOT NULL, creator_id TEXT NOT NULL, competition_id TEXT, track_name TEXT, title TEXT NOT NULL, description TEXT NOT NULL, roles TEXT, weekly_hours INTEGER, status TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS team_applications (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, applicant_id TEXT NOT NULL, message TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(project_id, applicant_id));" +
    "CREATE TABLE IF NOT EXISTS project_tasks (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, assignee TEXT, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS project_members (project_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT '成员', joined_at INTEGER NOT NULL, PRIMARY KEY(project_id,user_id));" +
    "CREATE TABLE IF NOT EXISTS project_invites (token TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, inviter_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, used_by TEXT, used_at INTEGER);" +
    "CREATE TABLE IF NOT EXISTS project_ai_reports (id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS admin_audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, details TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS password_reset_codes (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS ai_usage_events (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS competition_ai_analyses (competition_id TEXT NOT NULL, track_id TEXT NOT NULL, source_updated_at INTEGER NOT NULL, analysis TEXT NOT NULL, model TEXT NOT NULL, generated_at INTEGER NOT NULL, PRIMARY KEY(competition_id,track_id));",
  );
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_project_preferences (user_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS project_report_exports (user_id TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS project_report_exports_user_idx ON project_report_exports(user_id,created_at);
    CREATE TABLE IF NOT EXISTS project_files (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, owner_id TEXT NOT NULL, latest_version_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(project_id,kind,path));
    CREATE TABLE IF NOT EXISTS project_file_versions (id TEXT PRIMARY KEY, file_id TEXT NOT NULL, version INTEGER NOT NULL, uploader_id TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT NOT NULL, sha256 TEXT NOT NULL, storage_key TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(file_id,version));
    CREATE TABLE IF NOT EXISTS project_file_uploads (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, uploader_id TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL, expected_size INTEGER NOT NULL, received INTEGER NOT NULL, storage_key TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS project_files_project_idx ON project_files(project_id);
    CREATE INDEX IF NOT EXISTS project_file_versions_file_idx ON project_file_versions(file_id);
  `);
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
  const taskColumns = sqlite.prepare("PRAGMA table_info(project_tasks)").all() as Array<{ name: string }>;
  if (!taskColumns.some(column => column.name === "notes")) sqlite.exec("ALTER TABLE project_tasks ADD COLUMN notes TEXT");
  const projectColumns = sqlite.prepare("PRAGMA table_info(recruitment_projects)").all() as Array<{ name: string }>;
  if (!projectColumns.some((column) => column.name === "nickname")) sqlite.exec("ALTER TABLE recruitment_projects ADD COLUMN nickname TEXT");
  if (!projectColumns.some(column => column.name === "max_members")) sqlite.exec("ALTER TABLE recruitment_projects ADD COLUMN max_members INTEGER");
  sqlite.exec("UPDATE competitions SET review_status='pending' WHERE review_status='approved' AND status LIKE '%待核验%'");
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
  const columnsAfterRole = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columnsAfterRole.some((column) => column.name === "two_factor_enabled")) sqlite.exec("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0");
  const columnsAfterEnabled = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columnsAfterEnabled.some((column) => column.name === "two_factor_secret")) sqlite.exec("ALTER TABLE users ADD COLUMN two_factor_secret TEXT");
  sqlite.exec("CREATE TABLE IF NOT EXISTS user_avatars (user_id TEXT PRIMARY KEY NOT NULL, content BLOB NOT NULL, content_type TEXT NOT NULL, updated_at INTEGER NOT NULL)");
  initialized = true;
}
