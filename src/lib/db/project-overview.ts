import { sqlite } from "./client";
import { getProjectAccess, listProjectMembers } from "./project-members";
import { listProjectTasks } from "./tasks";

export function getProjectOverview(projectId: string, viewerId: string) {
  const viewerRole = getProjectAccess(projectId, viewerId);
  if (!viewerRole) return null;
  const project = sqlite.prepare(`SELECT p.id, p.description, p.status, p.weekly_hours AS weeklyHours,
    p.track_name AS trackName, c.name AS competitionName
    FROM recruitment_projects p LEFT JOIN competitions c ON c.id=p.competition_id AND c.review_status='approved'
    WHERE p.id=?`).get(projectId) as {
      id: string; description: string; status: string; weeklyHours: number | null;
      trackName: string | null; competitionName: string | null;
    } | undefined;
  if (!project) return null;
  const tasks = listProjectTasks(projectId);
  const members = listProjectMembers(projectId, viewerId);
  const unfinished = tasks.filter(task => task.status !== "已完成");
  const rank = (priority: string) => priority === "高" ? 0 : priority === "中" ? 1 : 2;
  return {
    project, viewerRole,
    tasks: [...unfinished].sort((a, b) => rank(a.priority) - rank(b.priority)).slice(0, 5),
    remaining: unfinished.length,
    totalTasks: tasks.length,
    members: members.slice(0, 5),
    memberCount: members.length,
    adminCount: members.filter(member => member.role === "管理员").length,
  };
}

export type ProjectOverviewData = NonNullable<ReturnType<typeof getProjectOverview>>;
