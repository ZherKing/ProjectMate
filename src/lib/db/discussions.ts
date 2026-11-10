import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";
import { getProjectAccess } from "./project-members";
import { SecurityError } from "@/lib/security/error";
import { limitSecurity } from "@/lib/security/service";
export type DiscussionMessage = { id:number; userId:string; name:string; body:string; createdAt:number };
function access(projectId:string,userId:string) {
  initializeDatabase();
  if (!getProjectAccess(projectId,userId)) throw new SecurityError("你已不在该项目中，无法访问讨论。",403);
}
export function discussionMessages(projectId:string,userId:string,before?:number,after?:number) {
  access(projectId,userId);
  if(after!==undefined){
    const rows=sqlite.prepare(`SELECT d.id,d.user_id AS userId,CASE WHEN u.deleted_at IS NOT NULL THEN '已注销用户' ELSE COALESCE(u.name,'项目成员') END AS name,d.body,d.created_at AS createdAt FROM project_discussion_messages d LEFT JOIN users u ON u.id=d.user_id WHERE d.project_id=? AND d.id>? ORDER BY d.id ASC LIMIT 30`).all(projectId,after) as DiscussionMessage[];
    return {messages:rows,hasMore:false};
  }
  const rows=sqlite.prepare(`SELECT d.id,d.user_id AS userId,CASE WHEN u.deleted_at IS NOT NULL THEN '已注销用户' ELSE COALESCE(u.name,'项目成员') END AS name,d.body,d.created_at AS createdAt FROM project_discussion_messages d LEFT JOIN users u ON u.id=d.user_id WHERE d.project_id=? AND d.id<? ORDER BY d.id DESC LIMIT 31`).all(projectId,before||Number.MAX_SAFE_INTEGER) as DiscussionMessage[];
  const hasMore=rows.length>30;
  return {messages:rows.slice(0,30).reverse(),hasMore};
}
export function sendDiscussionMessage(projectId:string,userId:string,body:string,requestId:string) {
  access(projectId,userId);
  const text=body.trim();
  if(!text||text.length>2000)throw new SecurityError("请输入1至2000字的讨论内容。");
  if(!/^[a-zA-Z0-9-]{16,64}$/.test(requestId))throw new SecurityError("消息标识无效，请重试。");
  return sqlite.transaction(()=>{
    access(projectId,userId);
    const existing=sqlite.prepare("SELECT id FROM project_discussion_messages WHERE project_id=? AND user_id=? AND request_id=?").get(projectId,userId,requestId);
    if(!existing){limitSecurity('discussion:'+userId,30,60000);sqlite.prepare("INSERT INTO project_discussion_messages(project_id,user_id,body,request_id,created_at) VALUES(?,?,?,?,?)").run(projectId,userId,text,requestId,Date.now());}
    return discussionMessages(projectId,userId);
  }).immediate();
}
