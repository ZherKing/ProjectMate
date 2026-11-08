import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";

export type ProjectRole = "创建者" | "管理员" | "成员";
export type ProjectMember = {
  id: string;
  name: string | null;
  role: ProjectRole;
  skills: string | null;
  joinedAt: number;
  avatarVersion: number | null;
};

export function getProjectAccess(projectId: string, userId: string): ProjectRole | null {
  initializeDatabase();
  const row = sqlite.prepare(`SELECT p.creator_id AS creatorId, m.role
    FROM recruitment_projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=?
    WHERE p.id=? AND (p.creator_id=? OR m.user_id IS NOT NULL)`)
    .get(userId, projectId, userId) as { creatorId: string; role: string | null } | undefined;
  return !row ? null : row.creatorId === userId ? "创建者" : row.role === "管理员" ? "管理员" : "成员";
}

// Reading a joined project must not broaden the existing owner-only write helper.
export function getViewableProjectId(userId: string, requestedId?: string) {
  initializeDatabase();
  if (requestedId) return getProjectAccess(requestedId, userId) ? requestedId : null;
  const row = sqlite.prepare(`SELECT p.id FROM recruitment_projects p
    LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=?
    WHERE p.creator_id=? OR m.user_id IS NOT NULL
    ORDER BY (p.creator_id=?) DESC, p.created_at DESC, p.id ASC LIMIT 1`)
    .get(userId, userId, userId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function listProjectMembers(projectId: string, viewerId: string): ProjectMember[] {
  if (!getProjectAccess(projectId, viewerId)) return [];
  return sqlite.prepare(`SELECT u.id, u.name,
    CASE WHEN u.id=p.creator_id THEN '创建者' WHEN m.role='管理员' THEN '管理员' ELSE '成员' END AS role,
    f.skills, COALESCE(m.joined_at,p.created_at) AS joinedAt, a.updated_at AS avatarVersion
    FROM recruitment_projects p JOIN users u ON u.id=p.creator_id OR EXISTS
      (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=u.id)
    LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=u.id
    LEFT JOIN profiles f ON f.user_id=u.id LEFT JOIN user_avatars a ON a.user_id=u.id
    WHERE p.id=? ORDER BY (u.id=p.creator_id) DESC, (m.role='管理员') DESC, joinedAt ASC, u.id ASC`)
    .all(projectId) as ProjectMember[];
}

export function changeProjectMember(input: { projectId: string; actorId: string; memberId: string; operation: "role" | "remove"; role?: string }) {
  initializeDatabase();
  return sqlite.transaction(() => {
    const actor = getProjectAccess(input.projectId, input.actorId);
    const target = getProjectAccess(input.projectId, input.memberId);
    if (!actor || actor === "成员") return { ok: false, message: "没有管理当前项目成员的权限。" };
    if (!target) return { ok: false, message: "该成员已离开项目，请刷新列表。" };
    if (target === "创建者" || input.actorId === input.memberId) return { ok: false, message: "不能对创建者或自己执行此操作。" };
    if (input.operation === "role") {
      if (actor !== "创建者") return { ok: false, message: "只有创建者可以调整管理员权限。" };
      if (input.role !== "管理员" && input.role !== "成员") return { ok: false, message: "请选择有效的项目权限。" };
      sqlite.prepare("UPDATE project_members SET role=? WHERE project_id=? AND user_id=?").run(input.role, input.projectId, input.memberId);
      // Links issued under administrator permissions expire when those permissions are revoked.
      if (input.role === "成员") sqlite.prepare("DELETE FROM project_invites WHERE project_id=? AND inviter_id=? AND used_by IS NULL").run(input.projectId, input.memberId);
    } else {
      if (actor === "管理员" && target !== "成员") return { ok: false, message: "管理员只能移除普通成员。" };
      sqlite.prepare("DELETE FROM project_members WHERE project_id=? AND user_id=?").run(input.projectId, input.memberId);
      sqlite.prepare("DELETE FROM project_invites WHERE project_id=? AND inviter_id=? AND used_by IS NULL").run(input.projectId, input.memberId);
    }
    sqlite.prepare("INSERT INTO admin_audit_logs(id,actor_id,action,target_type,target_id,details,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), input.actorId, input.operation === "role" ? "project-member-role" : "project-member-remove", "project", input.projectId,
        JSON.stringify({ memberId: input.memberId, previousRole: target, role: input.operation === "role" ? input.role : null }), Date.now());
    return { ok: true, message: input.operation === "role" ? "成员权限已更新。" : "成员已移出项目，已有任务记录已保留。" };
  })();
}
