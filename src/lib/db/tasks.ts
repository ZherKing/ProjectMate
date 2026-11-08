import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";

export function listProjectTasks(projectId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, project_id AS projectId, title, notes, status, priority, assignee FROM project_tasks WHERE project_id = ? ORDER BY created_at ASC").all(projectId) as Array<{ id: string; projectId: string; title: string; notes: string | null; status: string; priority: string; assignee: string | null }>;
}

export function updateProjectTaskStatus(taskId: string, status: string) {
  initializeDatabase();
  sqlite.prepare("UPDATE project_tasks SET status = ? WHERE id = ?").run(status, taskId);
}

export function saveCoachReport(projectId: string, summary: string, source: string) {
  initializeDatabase();
  sqlite.prepare("INSERT INTO project_ai_reports (id, project_id, summary, source, created_at) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), projectId, summary, source, Date.now());
}

export function getLatestCoachReport(projectId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT summary, source, created_at AS createdAt FROM project_ai_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get(projectId) as { summary: string; source: string; createdAt: number } | undefined;
}
