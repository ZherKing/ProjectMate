import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { seedDatabase } from "./seed";

export type CompetitionListItem = {
  id: string;
  platform: string;
  name: string;
  season: string | null;
  status: string;
  sourceUrl: string;
  updatedAt: number;
  reviewStatus?: string;
};

export function listCompetitions(): CompetitionListItem[] {
  initializeDatabase();
  seedDatabase();
  return sqlite.prepare(
    "SELECT id, platform, name, season, status, source_url AS sourceUrl, updated_at AS updatedAt, review_status AS reviewStatus FROM competitions WHERE review_status = 'approved' ORDER BY updated_at DESC, name ASC",
  ).all() as CompetitionListItem[];
}

export function listFavoriteCompetitionIds(userId: string): Set<string> {
  initializeDatabase();
  sqlite.exec("CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL, item_key TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, item_key))");
  const rows = sqlite.prepare("SELECT item_key AS itemKey FROM favorites WHERE user_id = ?").all(userId) as Array<{ itemKey: string }>;
  return new Set(rows.map((row) => row.itemKey));
}

export function listCompetitionTracks(): { competitionId: string; names: string[]; deadline: number | null }[] {
  initializeDatabase();
  const rows = sqlite.prepare(
    "SELECT competition_id AS competitionId, name, deadline FROM competition_tracks ORDER BY name",
  ).all() as { competitionId: string; name: string; deadline: number | null }[];
  const grouped = new Map<string, { names: string[]; deadline: number | null }>();
  for (const row of rows) {
    const item = grouped.get(row.competitionId) ?? { names: [], deadline: null };
    item.names.push(row.name);
    if (row.deadline != null && (item.deadline == null || row.deadline < item.deadline)) item.deadline = row.deadline;
    grouped.set(row.competitionId, item);
  }
  return [...grouped].map(([competitionId, item]) => ({ competitionId, ...item }));
}

export function getCompetition(id: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, platform, name, season, status, source_url AS sourceUrl, updated_at AS updatedAt, review_status AS reviewStatus FROM competitions WHERE id = ? AND review_status = 'approved'").get(id) as CompetitionListItem | undefined;
}

export type PendingCompetition = CompetitionListItem & { reviewStatus: string; reviewedBy: string | null; reviewedAt: number | null; reviewNote: string | null };

export function listPendingCompetitions(): PendingCompetition[] {
  initializeDatabase();
  return sqlite.prepare("SELECT id, platform, name, season, status, source_url AS sourceUrl, updated_at AS updatedAt, review_status AS reviewStatus, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, review_note AS reviewNote FROM competitions WHERE review_status = 'pending' ORDER BY updated_at DESC, name ASC").all() as PendingCompetition[];
}

export type AdminUser = { id: string; email: string; name: string | null; role: string; createdAt: number };

export function listAdminUsers(): AdminUser[] {
  initializeDatabase();
  return sqlite.prepare("SELECT id, email, name, role, created_at AS createdAt FROM users ORDER BY created_at DESC").all() as AdminUser[];
}

export type AdminAuditLog = { id: string; actorId: string; actorEmail: string | null; action: string; targetType: string; targetId: string; details: string; createdAt: number };

export function listAdminAuditLogs(limit = 50): AdminAuditLog[] {
  initializeDatabase();
  return sqlite.prepare("SELECT logs.id, logs.actor_id AS actorId, users.email AS actorEmail, logs.action, logs.target_type AS targetType, logs.target_id AS targetId, logs.details, logs.created_at AS createdAt FROM admin_audit_logs logs LEFT JOIN users ON users.id = logs.actor_id ORDER BY logs.created_at DESC LIMIT ?").all(Math.max(1, Math.min(100, limit))) as AdminAuditLog[];
}

export function getCompetitionTrackDetails(competitionId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, name, description, deadline FROM competition_tracks WHERE competition_id = ? ORDER BY name").all(competitionId) as Array<{ id: string; name: string; description: string | null; deadline: number | null }>;
}
