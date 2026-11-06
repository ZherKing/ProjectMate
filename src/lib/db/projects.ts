import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";

export function createRecruitmentProject(input: {
  creatorId: string;
  competitionId: string;
  trackName: string;
  title: string;
  description: string;
  roles: string;
  weeklyHours: number;
}) {
  initializeDatabase();
  const id = crypto.randomUUID();
  sqlite.prepare("INSERT INTO recruitment_projects (id, creator_id, competition_id, track_name, title, description, roles, weekly_hours, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.creatorId, input.competitionId, input.trackName, input.title, input.description, input.roles, input.weeklyHours, "招募中", Date.now());
  return id;
}

export function listRecruitmentProjects() {
  initializeDatabase();
  return sqlite.prepare("SELECT id, creator_id AS creatorId, competition_id AS competitionId, track_name AS trackName, title, description, roles, weekly_hours AS weeklyHours, status, (SELECT name FROM users WHERE users.id = recruitment_projects.creator_id) AS creatorName FROM recruitment_projects ORDER BY created_at DESC").all() as Array<{ id: string; title: string; description: string; roles: string | null; trackName: string | null; status: string; weeklyHours: number | null; creatorName: string | null }>;
}

export function getAccessibleProjectId(userId: string, requestedId?: string) {
  initializeDatabase();
  if (requestedId) {
    const owned = sqlite.prepare("SELECT id FROM recruitment_projects WHERE id = ? AND creator_id = ?").get(requestedId, userId) as { id: string } | undefined;
    return owned?.id ?? null;
  }
  const firstOwned = sqlite.prepare("SELECT id FROM recruitment_projects WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1").get(userId) as { id: string } | undefined;
  return firstOwned?.id ?? null;
}

export function applyToRecruitmentProject(input: { projectId: string; applicantId: string; message?: string }) {
  initializeDatabase();
  sqlite.prepare(
    "INSERT OR IGNORE INTO team_applications (id, project_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), input.projectId, input.applicantId, input.message ?? "", "待审核", Date.now());
}
