import { currentUserId, fileFailure } from "@/lib/files/http";
import { FileError } from "@/lib/files/store";
import { getProjectAccess } from "@/lib/db/project-members";
import { sqlite } from "@/lib/db/client";
import { buildProjectReport, projectReportFilename, projectReportSnapshot } from "@/lib/reports/project-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string}>}){
 try{
  const userId=await currentUserId(),{projectId}=await params,data=projectReportSnapshot(projectId,userId),now=Date.now();
  sqlite.transaction(()=>{sqlite.prepare("DELETE FROM project_report_exports WHERE created_at<?").run(now-60*60*1000);const count=sqlite.prepare("SELECT COUNT(*) AS count FROM project_report_exports WHERE user_id=? AND created_at>?").get(userId,now-60*1000) as {count:number};if(count.count>=5)throw new FileError("报告导出较频繁，请稍后再试。",429);sqlite.prepare("INSERT INTO project_report_exports(user_id,created_at) VALUES(?,?)").run(userId,now);})();
  const bytes=await buildProjectReport(data);
  if(!getProjectAccess(projectId,userId))throw new FileError("项目访问权限已变化，请刷新后重试。",403);
  const name=encodeURIComponent(projectReportFilename(data)).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`);
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="project-report.docx"; filename*=UTF-8''${name}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Cookie"}});
 }catch(error){return fileFailure(error);}
}
