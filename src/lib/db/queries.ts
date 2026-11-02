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
