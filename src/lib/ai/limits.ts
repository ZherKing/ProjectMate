import { randomUUID } from "node:crypto";
import { initializeDatabase } from "@/lib/db/initialize";
import { sqlite } from "@/lib/db/client";

export function consumeAiQuota(userId: string, action: string, limit = 10, windowMs = 10 * 60 * 1000) {
  initializeDatabase();
  const now = Date.now();
  const count = sqlite.prepare("SELECT COUNT(*) AS count FROM ai_usage_events WHERE user_id=? AND created_at>=?").get(userId, now - windowMs) as { count: number };
  if (count.count >= limit) return false;
  sqlite.prepare("INSERT INTO ai_usage_events(id,user_id,action,created_at) VALUES(?,?,?,?)").run(randomUUID(), userId, action, now);
  sqlite.prepare("DELETE FROM ai_usage_events WHERE created_at<?").run(now - 24 * 60 * 60 * 1000);
  return true;
}
