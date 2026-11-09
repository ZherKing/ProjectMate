import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { recordNotification, projectManagers } from "@/lib/notifications/store";
import { limitSecurity, userByEmail } from "@/lib/security/service";
import { getProjectAccess, getViewableProjectId } from "./project-members";

import { requireOpenProjectSeat, selectActiveProject, ProjectSettingsError } from "./project-settings";

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
  return sqlite.transaction(() => {
  sqlite.prepare("INSERT INTO recruitment_projects (id, creator_id, competition_id, track_name, title, description, roles, weekly_hours, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.creatorId, input.competitionId, input.trackName, input.title, input.description, input.roles, input.weeklyHours, "招募中", Date.now());
  sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(id, input.creatorId, "项目发起人", Date.now());
  selectActiveProject(input.creatorId,id);
  return id;
  }).immediate();
}

export function listRecruitmentProjects() {
  initializeDatabase();
  const rows = sqlite.prepare("SELECT id, creator_id AS creatorId, competition_id AS competitionId, track_name AS trackName, title, description, roles, weekly_hours AS weeklyHours, max_members AS maxMembers, status, (SELECT name FROM users WHERE users.id = recruitment_projects.creator_id) AS creatorName, (SELECT COUNT(*) FROM users u WHERE u.id=recruitment_projects.creator_id OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=recruitment_projects.id AND m.user_id=u.id)) AS memberCount FROM recruitment_projects ORDER BY created_at DESC").all() as Array<{ id: string; title: string; description: string; roles: string | null; trackName: string | null; status: string; weeklyHours: number | null; creatorName: string | null; memberCount: number; maxMembers: number | null }>;
  return rows.map((row) => ({ ...row, seatCount: row.maxMembers }));
}

export function getAccessibleProjectId(userId: string, requestedId?: string) {
  initializeDatabase();
  if (requestedId) {
    const owned = sqlite.prepare("SELECT id FROM recruitment_projects WHERE id = ? AND creator_id = ?").get(requestedId, userId) as { id: string } | undefined;
    return owned?.id ?? null;
  }
  const active=getViewableProjectId(userId);
  return active&&getProjectAccess(active,userId)==="创建者"?active:null;
}

export function getOwnedProjectContext(userId: string, projectId: string) {
  initializeDatabase();
  return sqlite.prepare("SELECT id, title, nickname, description, track_name AS trackName FROM recruitment_projects WHERE id = ? AND creator_id = ?").get(projectId, userId) as { id: string; title: string; nickname: string | null; description: string; trackName: string | null } | undefined;
}

export function getProjectStats(projectId: string) {
  initializeDatabase();
  const tasks = sqlite.prepare("SELECT id,title,status,priority,assignee FROM project_tasks WHERE project_id=? ORDER BY created_at ASC").all(projectId) as Array<{ id: string; title: string; status: string; priority: string; assignee: string | null }>;
  const memberCount = sqlite.prepare("SELECT COUNT(*) AS count FROM users u WHERE u.id=(SELECT creator_id FROM recruitment_projects WHERE id=?) OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id=? AND m.user_id=u.id)").get(projectId,projectId) as { count: number };
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

export function createProjectInvite(projectId: string, inviterId: string, recipientEmail = "") {
  initializeDatabase();
  const access = getProjectAccess(projectId, inviterId);
  if (access !== "创建者" && access !== "管理员") return null;
  requireOpenProjectSeat(projectId);
  limitSecurity("team-invites:"+inviterId,100,3600000);
  const recipient=recipientEmail.trim()?userByEmail(recipientEmail):null;
  if(recipientEmail.trim()&&!recipient)throw new ProjectSettingsError("未找到该站内账号，请使用已注册的登录邮箱。",404);
  if(recipient&&getProjectAccess(projectId,recipient.id))throw new ProjectSettingsError("对方已经是项目成员，无需重复邀请。",409);
  if(recipient)limitSecurity("team-invite-pair:"+inviterId+":"+recipient.id,10,86400000);
  const token = crypto.randomUUID().replace(/-/g, "");
  return sqlite.transaction(()=>{
  sqlite.prepare("INSERT INTO project_invites(token,project_id,inviter_id,expires_at,created_at,invited_user_id) VALUES(?,?,?,?,?,?)").run(token, projectId, inviterId, Date.now() + 7 * 24 * 60 * 60 * 1000, Date.now(),recipient?.id||null);
  if(recipient){const project=sqlite.prepare("SELECT COALESCE(nickname,title) AS name FROM recruitment_projects WHERE id=?").get(projectId) as {name:string};recordNotification({key:"invite:"+token,type:"team.invited",projectId,actorId:inviterId,title:"收到组队邀请",message:`你收到加入“${project.name}”的邀请。请登录对应站内账号确认。`,href:"/projects/invite?token="+encodeURIComponent(token),recipients:[recipient.id],data:{projectId}});}
  return token;
  }).immediate();
}

export function acceptProjectInvite(token: string, userId: string) {
  initializeDatabase();
  return sqlite.transaction(() => {
    const invite = sqlite.prepare("SELECT token,project_id AS projectId,inviter_id AS inviterId,expires_at AS expiresAt,used_by AS usedBy,invited_user_id AS invitedUserId FROM project_invites WHERE token=?").get(token) as { token: string; projectId: string; inviterId: string; expiresAt: number; usedBy: string | null; invitedUserId: string | null } | undefined;
    if (!invite || invite.expiresAt < Date.now() || invite.usedBy) return { ok: false, message: "邀请链接已失效或已使用。" };
    if(invite.invitedUserId&&invite.invitedUserId!==userId)return{ok:false,message:"此邀请发给其他账号，请切换到正确账号。"};
    const access = getProjectAccess(invite.projectId, invite.inviterId);
    if (access !== "创建者" && access !== "管理员") return { ok: false, message: "邀请人的项目管理权限已失效，请联系创建者。" };
    if (getProjectAccess(invite.projectId, userId)) { selectActiveProject(userId,invite.projectId); return { ok: true, projectId: invite.projectId }; }
    try { requireOpenProjectSeat(invite.projectId); } catch(error) { if(error instanceof ProjectSettingsError)return {ok:false,message:error.message};throw error; }
    sqlite.prepare("INSERT OR IGNORE INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(invite.projectId, userId, "成员", Date.now());
    sqlite.prepare("UPDATE project_invites SET used_by=?,used_at=? WHERE token=?").run(userId, Date.now(), token);
    selectActiveProject(userId,invite.projectId);
    const project=sqlite.prepare("SELECT COALESCE(nickname,title) AS name,creator_id AS creatorId FROM recruitment_projects WHERE id=?").get(invite.projectId) as {name:string;creatorId:string};
    const member=sqlite.prepare("SELECT name FROM users WHERE id=?").get(userId) as {name:string|null};
    recordNotification({key:"invite-accepted:"+token,type:"team.invitation_accepted",projectId:invite.projectId,actorId:userId,title:"队友已接受组队邀请",message:`${member.name||"新成员"}已接受邀请，加入“${project.name}”。`,href:"/projects/members?project="+encodeURIComponent(invite.projectId),recipients:[invite.inviterId,project.creatorId],data:{projectId:invite.projectId,userId}});
    return { ok: true, projectId: invite.projectId };
  }).immediate();
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
  return sqlite.transaction(() => {
  requireOpenProjectSeat(input.projectId);
  if(getProjectAccess(input.projectId,input.applicantId))throw new ProjectSettingsError("你已是项目成员，无需重复申请。",409);
  const applicationId=crypto.randomUUID();
  const result=sqlite.prepare(
    "INSERT OR IGNORE INTO team_applications (id, project_id, applicant_id, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(applicationId, input.projectId, input.applicantId, input.message ?? "", "待审核", Date.now());
  if(result.changes){const project=sqlite.prepare("SELECT COALESCE(nickname,title) AS name FROM recruitment_projects WHERE id=?").get(input.projectId) as {name:string};const applicant=sqlite.prepare("SELECT name FROM users WHERE id=?").get(input.applicantId) as {name:string|null};recordNotification({key:"application:"+applicationId,type:"team.application_received",projectId:input.projectId,actorId:input.applicantId,title:"收到新的组队申请",message:`${applicant.name||"一位用户"}申请加入“${project.name}”。`,href:"/projects/members?project="+encodeURIComponent(input.projectId),recipients:projectManagers(input.projectId),data:{projectId:input.projectId,applicationId}});}
  }).immediate();
}
