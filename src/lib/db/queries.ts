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
};

export function listCompetitions(): CompetitionListItem[] {
  initializeDatabase();
  seedDatabase();
  return sqlite.prepare(
    "SELECT id, platform, name, season, status, source_url AS sourceUrl, updated_at AS updatedAt FROM competitions ORDER BY updated_at DESC, name ASC",
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
  return sqlite.prepare("SELECT id, platform, name, season, status, source_url AS sourceUrl, updated_at AS updatedAt FROM competitions WHERE id = ?").get(id) as CompetitionListItem | undefined;
}

export function getCompetitionTrackDetails(competitionId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, name, description, deadline FROM competition_tracks WHERE competition_id = ? ORDER BY name").all(competitionId) as Array<{ id: string; name: string; description: string | null; deadline: number | null }>;
}
