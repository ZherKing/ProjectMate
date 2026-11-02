import { createHash } from "node:crypto";
import type { RawCompetition } from "./types";

export function normalizeCompetition(item: RawCompetition) {
  const name = item.name.replace(/\s+/g, " ").trim();
  const sourceUrl = item.sourceUrl.trim();
  const id = createHash("sha1").update(item.platform + ":" + sourceUrl).digest("hex").slice(0, 24);
  return {
    id,
    platform: item.platform.trim(),
    name,
    season: item.season?.trim() ?? null,
    status: item.status?.trim() || "待确认",
    sourceUrl,
    updatedAt: Date.now(),
  };
}
