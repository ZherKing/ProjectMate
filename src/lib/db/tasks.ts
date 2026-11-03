import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";

export function listProjectTasks(projectId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, project_id AS projectId, title, status, priority, assignee FROM project_tasks WHERE project_id = ? ORDER BY created_at ASC").all(projectId) as Array<{ id: string; projectId: string; title: string; status: string; priority: string; assignee: string | null }>;
}
