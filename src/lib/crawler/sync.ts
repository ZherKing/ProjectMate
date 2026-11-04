import type { RawCompetition } from "./types";
import { initializeDatabase } from "@/lib/db/initialize";
import { seedDatabase } from "@/lib/db/seed";
import { sqlite } from "@/lib/db/client";
import { normalizeCompetition } from "./normalize";
import { SaikrAdapter } from "./adapters/saikr";
import { BoxueguAdapter } from "./adapters/boxuegu";

const adapters = [new SaikrAdapter(), new BoxueguAdapter()];

export async function syncCompetitions(): Promise<RawCompetition[]> {
  initializeDatabase();
  seedDatabase();
  const all: RawCompetition[] = [];

  for (const adapter of adapters) {
    try {
      const sourceUrl = adapter instanceof BoxueguAdapter
        ? (process.env.BOXUEGU_CONTESTS_URL ?? "https://www.boxuegu.com/matchTrack/")
        : (process.env.SAIKR_CONTESTS_URL ?? "https://www.saikr.com/contests");
      const items = await adapter.fetchAndParse(sourceUrl);
      all.push(...items);
      const upsert = sqlite.prepare(
        "INSERT INTO competitions (id, platform, name, season, status, source_url, updated_at) VALUES (@id, @platform, @name, @season, @status, @sourceUrl, @updatedAt) ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status, updated_at=excluded.updated_at",
      );
      const write = sqlite.transaction(() => {
        for (const item of items) {
          const normalized = normalizeCompetition(item);
          upsert.run(normalized);
          for (const track of item.tracks ?? []) {
            sqlite.prepare(
              "INSERT INTO competition_tracks (id, competition_id, name, description, deadline) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, deadline=excluded.deadline",
            ).run(
              adapter.sourceName + ":" + track.externalId,
              normalized.id,
              track.name,
              track.description ?? null,
              track.deadline ? Date.parse(track.deadline) : null,
            );
          }
        }
      });
      write();
      console.log(adapter.sourceName + " 同步 " + items.length + " 条赛事");
    } catch (error) {
      console.error(adapter.sourceName + " 同步失败，保留已有数据", error);
    }
  }

  return all;
}

if (process.argv[1]?.endsWith("sync.ts")) {
  syncCompetitions().then(() => {
    console.log("Competition sync completed.");
  });
}
