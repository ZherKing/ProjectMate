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
  sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(id, input.creatorId, "项目发起人", Date.now());
  return id;
}

export function listRecruitmentProjects() {
  initializeDatabase();
  const rows = sqlite.prepare("SELECT id, creator_id AS creatorId, competition_id AS competitionId, track_name AS trackName, title, description, roles, weekly_hours AS weeklyHours, status, (SELECT name FROM users WHERE users.id = recruitment_projects.creator_id) AS creatorName, (SELECT COUNT(*) FROM project_members WHERE project_members.project_id = recruitment_projects.id) AS memberCount FROM recruitment_projects ORDER BY created_at DESC").all() as Array<{ id: string; title: string; description: string; roles: string | null; trackName: string | null; status: string; weeklyHours: number | null; creatorName: string | null; memberCount: number }>;
  return rows.map((row) => ({ ...row, seatCount: Math.max(row.memberCount + (row.roles ? row.roles.split(/[，,、/]+/).map((role) => role.trim()).filter(Boolean).length : 1), row.memberCount) }));
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

export function getOwnedProjectContext(userId: string, projectId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, title, nickname, description, track_name AS trackName FROM recruitment_projects WHERE id = ? AND creator_id = ?").get(projectId, userId) as { id: string; title: string; nickname: string | null; description: string; trackName: string | null } | undefined;
}

export function getProjectStats(projectId: string) {
  initializeDatabase();
  const tasks = sqlite.prepare("SELECT id,title,status,priority,assignee FROM project_tasks WHERE project_id=? ORDER BY created_at ASC").all(projectId) as Array<{ id: string; title: string; status: string; priority: string; assignee: string | null }>;
  const memberCount = sqlite.prepare("SELECT COUNT(*) AS count FROM project_members WHERE project_id=?").get(projectId) as { count: number };
  const members = sqlite.prepare("SELECT users.name AS name, project_members.role AS role FROM project_members LEFT JOIN users ON users.id=project_members.user_id WHERE project_members.project_id=? ORDER BY project_members.joined_at ASC").all(projectId) as Array<{ name: string | null; role: string }>;
  const completed = tasks.filter((task) => task.status === "已完成").length;
  const active = tasks.filter((task) => task.status !== "已完成");
  const loads = new Map<string, number>();
  for (const task of active) if (task.assignee) loads.set(task.assignee, (loads.get(task.assignee) || 0) + (task.priority === "高" ? 2 : 1));
  return { tasks, members, memberCount: memberCount.count, completion: tasks.length ? Math.round((completed / tasks.length) * 100) : 0, completed, remaining: active.length, loads: [...loads].map(([name, score]) => ({ name, score })) };
}

export function updateProjectNickname(projectId: string, userId: string, nickname: string) {
  initializeDatabase();
  return sqlite.prepare("UPDATE recruitment_projects SET nickname=? WHERE id=? AND creator_id=?").run(nickname.slice(0, 80), projectId, userId).changes > 0;
}

export function createProjectInvite(projectId: string, inviterId: string) {
  initializeDatabase();
  const token = crypto.randomUUID().replace(/-/g, "");
  sqlite.prepare("INSERT INTO project_invites(token,project_id,inviter_id,expires_at,created_at) VALUES(?,?,?,?,?)").run(token, projectId, inviterId, Date.now() + 7 * 24 * 60 * 60 * 1000, Date.now());
  return token;
}

export function acceptProjectInvite(token: string, userId: string) {
  initializeDatabase();
  const invite = sqlite.prepare("SELECT token,project_id AS projectId,expires_at AS expiresAt,used_by AS usedBy FROM project_invites WHERE token=?").get(token) as { token: string; projectId: string; expiresAt: number; usedBy: string | null } | undefined;
  if (!invite || invite.expiresAt < Date.now() || invite.usedBy) return { ok: false, message: "邀请链接已失效或已使用。" };
  sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(invite.projectId, userId, "成员", Date.now());
  sqlite.prepare("UPDATE project_invites SET used_by=?,used_at=? WHERE token=?").run(userId, Date.now(), token);
  return { ok: true, projectId: invite.projectId };
}

export function addProjectTask(projectId: string, userId: string, input: { title: string; priority: string; assignee: string }) {
  initializeDatabase();
  const owner = sqlite.prepare("SELECT id FROM recruitment_projects WHERE id=? AND creator_id=?").get(projectId, userId);
  if (!owner) return null;
  const id = crypto.randomUUID();
  sqlite.prepare("INSERT INTO project_tasks(id,project_id,title,status,priority,assignee,created_at) VALUES(?,?,?,?,?,?,?)").run(id, projectId, input.title.slice(0, 160), "待分配", input.priority, input.assignee.slice(0, 80) || null, Date.now());
  return id;
}

export function applyToRecruitmentProject(input: { projectId: string; applicantId: string; message?: string }) {
  initializeDatabase();
  sqlite.prepare(
    "INSERT OR IGNORE INTO team_applications (id, project_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), input.projectId, input.applicantId, input.message ?? "", "待审核", Date.now());
}
