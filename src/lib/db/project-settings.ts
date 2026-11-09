import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { getProjectAccess, type ProjectRole } from "./project-members";

export class ProjectSettingsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function projectMemberCount(projectId: string) {
  initializeDatabase();
  return (sqlite.prepare("SELECT COUNT(*) AS count FROM users u WHERE u.id=(SELECT creator_id FROM recruitment_projects WHERE id=?) OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=? AND m.user_id=u.id)").get(projectId,projectId) as {count:number}).count;
}
export type UserProject = { id:string; name:string; role:ProjectRole; status:string; maxMembers:number|null; memberCount:number };
export function listUserProjects(userId:string):UserProject[] {
  initializeDatabase();
  return sqlite.prepare(`SELECT p.id,COALESCE(NULLIF(p.nickname,''),p.title) AS name,p.status,p.max_members AS maxMembers,
    CASE WHEN p.creator_id=? THEN '创建者' WHEN m.role='管理员' THEN '管理员' ELSE '成员' END AS role,
    (SELECT COUNT(*) FROM users u WHERE u.id=p.creator_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=u.id)) AS memberCount
    FROM recruitment_projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=?
    WHERE p.creator_id=? OR m.user_id IS NOT NULL ORDER BY p.created_at DESC,p.id ASC`).all(userId,userId,userId) as UserProject[];
}
export function getProjectSettings(projectId:string,userId:string) {
  const role=getProjectAccess(projectId,userId);
  if(!role)throw new ProjectSettingsError("没有当前项目的访问权限。",403);
  const project=sqlite.prepare("SELECT id,COALESCE(NULLIF(nickname,''),title) AS name,status,max_members AS maxMembers FROM recruitment_projects WHERE id=?").get(projectId) as {id:string;name:string;status:string;maxMembers:number|null};
  return {...project,role,memberCount:projectMemberCount(projectId)};
}
export function updateProjectSettings(projectId:string,userId:string,input:{maxMembers:number|null;status:string}) {
  initializeDatabase();
  return sqlite.transaction(()=>{
    const current=getProjectSettings(projectId,userId);
    if(current.role!=="创建者"&&current.role!=="管理员")throw new ProjectSettingsError("只有创建者或管理员可以修改团队设置。",403);
    if(input.maxMembers!==null&&(!Number.isSafeInteger(input.maxMembers)||input.maxMembers<1||input.maxMembers>1000))throw new ProjectSettingsError("团队人数上限需为1到1000的整数，或留空表示未设置。");
    if(input.maxMembers!==null&&input.maxMembers<current.memberCount)throw new ProjectSettingsError(`人数上限不能低于当前 ${current.memberCount} 位成员。`);
    if(!["招募中","暂停招募"].includes(input.status)&&input.status!==current.status)throw new ProjectSettingsError("请选择有效的招募状态。");
    sqlite.prepare("UPDATE recruitment_projects SET max_members=?,status=? WHERE id=?").run(input.maxMembers,input.status,projectId);
    if(current.maxMembers!==input.maxMembers||current.status!==input.status)sqlite.prepare("INSERT INTO admin_audit_logs(id,actor_id,action,target_type,target_id,details,created_at) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),userId,"project-settings","project",projectId,JSON.stringify({previous:{maxMembers:current.maxMembers,status:current.status},current:input}),Date.now());
    return getProjectSettings(projectId,userId);
  }).immediate();
}
export function selectActiveProject(userId:string,projectId:string) {
  initializeDatabase();
  if(!getProjectAccess(projectId,userId))throw new ProjectSettingsError("该项目不存在或你已不再是项目成员。",403);
  sqlite.prepare("INSERT INTO user_project_preferences(user_id,project_id,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET project_id=excluded.project_id,updated_at=excluded.updated_at").run(userId,projectId,Date.now());
}
export function requireOpenProjectSeat(projectId:string) {
  initializeDatabase();
  const project=sqlite.prepare("SELECT status,max_members AS maxMembers FROM recruitment_projects WHERE id=?").get(projectId) as {status:string;maxMembers:number|null}|undefined;
  if(!project)throw new ProjectSettingsError("项目不存在。",404);
  if(project.status!=="招募中")throw new ProjectSettingsError("该项目已暂停招募，暂时不能加入。",409);
  if(project.maxMembers!==null&&projectMemberCount(projectId)>=project.maxMembers)throw new ProjectSettingsError("团队人数已达到上限，暂时不能加入。",409);
}
