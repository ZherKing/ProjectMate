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

export function getCompetitionTrackDetails(competitionId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, name, description, deadline FROM competition_tracks WHERE competition_id = ? ORDER BY name").all(competitionId) as Array<{ id: string; name: string; description: string | null; deadline: number | null }>;
}
