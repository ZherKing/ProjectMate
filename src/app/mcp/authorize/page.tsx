import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { sqlite } from "@/lib/db/client";
import { createConsent, validateAuthorization } from "@/lib/mcp/oauth";
import { authorizeMcpAction } from "./actions";
export const dynamic="force-dynamic";
export const metadata={title:"授权 MCP 访问"};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw=await searchParams, query=new URLSearchParams(); Object.entries(raw).forEach(([k,v])=>{if(typeof v==="string")query.set(k,v);});
  const user=(await auth())?.user;
  if(!user?.id)redirect("/login?next="+encodeURIComponent("/mcp/authorize?"+query.toString()));
  let request,nonce,error;
  try { request=validateAuthorization(query);nonce=createConsent(user.id,request); } catch(e){error=e instanceof Error?e.message:"授权请求无效。";}
  if(!request||!nonce)return <SiteShell><main className="pm-page"><section className="pm-panel pm-mcp-consent"><h1>无法授权</h1><p>{error}</p><a href="/projects" className="pm-button-outline">返回项目空间</a></section></main></SiteShell>;
  const projects=sqlite.prepare("SELECT DISTINCT p.id,COALESCE(p.nickname,p.title) AS title FROM recruitment_projects p LEFT JOIN project_members m ON m.project_id=p.id AND m.user_id=? WHERE p.creator_id=? OR m.user_id IS NOT NULL ORDER BY p.created_at DESC").all(user.id,user.id) as Array<{id:string;title:string}>;
  return <SiteShell><main className="pm-page"><section className="pm-panel pm-mcp-consent"><h1>授权 MCP 访问</h1><p>“{request.clientName}”请求访问你的项目文件。授权仅限所选项目，30天有效，可在文档产出页面随时撤销。</p><p>客户端名称由申请方提供，请确认这是你主动连接的应用。</p><form action={authorizeMcpAction} noValidate><input type="hidden" name="nonce" value={nonce}/><div className="pm-workspace-form"><label>授权项目<select name="projectId" aria-label="授权项目">{projects.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}</select></label>{!projects.length&&<p>暂无可授权项目，请先创建或加入项目。</p>}<p>默认允许列出和读取所选项目的文档与代码。</p>{request.scope.includes("files:write")&&<label className="pm-mcp-write-consent"><input type="checkbox" name="write" value="yes"/>允许上传文件及提交新版本（遵循项目成员权限）</label>}</div><div className="pm-todo-editor-actions"><button type="submit" name="decision" value="deny" className="pm-button-outline">拒绝</button><button type="submit" name="decision" value="allow" className="pm-button-primary" disabled={!projects.length}>同意授权</button></div></form></section></main></SiteShell>;
}
