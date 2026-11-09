import { AlignmentType, BorderStyle, Document, Footer, HeadingLevel, PageNumber, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType, type FileChild } from "docx";
import { initializeDatabase } from "@/lib/db/initialize";
import { sqlite } from "@/lib/db/client";
import { getProjectAccess, listProjectMembers } from "@/lib/db/project-members";
import { listProjectTasks, getLatestCoachReport } from "@/lib/db/tasks";
import { listProjectFiles, FileError } from "@/lib/files/store";

export function projectReportSnapshot(projectId:string,userId:string){
 initializeDatabase();
 return sqlite.transaction(()=>{
  if(!getProjectAccess(projectId,userId))throw new FileError("没有当前项目的报告访问权限。",403);
  const project=sqlite.prepare(`SELECT p.id,COALESCE(NULLIF(p.nickname,''),p.title) AS name,p.description,p.track_name AS trackName,p.status,p.weekly_hours AS weeklyHours,p.max_members AS maxMembers,c.name AS competitionName FROM recruitment_projects p LEFT JOIN competitions c ON c.id=p.competition_id AND c.review_status='approved' WHERE p.id=?`).get(projectId) as {id:string;name:string;description:string;trackName:string|null;status:string;weeklyHours:number|null;maxMembers:number|null;competitionName:string|null};
  const account=sqlite.prepare("SELECT name FROM users WHERE id=?").get(userId) as {name:string|null}|undefined;
  if(!account)throw new FileError("登录账号已失效。",401);
  const tasks=listProjectTasks(projectId),members=listProjectMembers(projectId,userId),files=listProjectFiles(projectId,userId),coach=getLatestCoachReport(projectId);
  const completed=tasks.filter(t=>t.status==="已完成").length;
  return {project,tasks,members,files,coach,completed,completion:tasks.length?Math.round(completed/tasks.length*100):0,generatedAt:Date.now(),exporterName:account.name||"未设置昵称"};
 })();
}
export type ProjectReportSnapshot=ReturnType<typeof projectReportSnapshot>;
function clean(value:string){return Buffer.from(value,"utf8").toString("utf8").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,"");}
function when(time:number){return new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(time);}
const width=9746,font={ascii:"Calibri",hAnsi:"Calibri",eastAsia:"Microsoft YaHei",cs:"Calibri"};
function paragraph(text:string,keepNext=false){return new Paragraph({keepNext,children:[new TextRun({text:clean(text)})]});}
function heading(text:string){return new Paragraph({text,heading:HeadingLevel.HEADING_1});}
function table(headers:string[],data:string[][],widths:number[]){
 const rows=[headers,...data].map((values,rowIndex)=>new TableRow({tableHeader:rowIndex===0,cantSplit:true,children:values.map((value,index)=>new TableCell({width:{size:widths[index],type:WidthType.DXA},shading:rowIndex===0?{fill:"F0EFFF"}:undefined,children:[new Paragraph({keepNext:rowIndex===0,spacing:{before:0,after:40,line:240},children:[new TextRun({text:clean(value),size:20,bold:rowIndex===0})]})]}))}));
 const border={style:BorderStyle.SINGLE,size:4,color:"E4E4EF"};
 return new Table({width:{size:width,type:WidthType.DXA},layout:TableLayoutType.FIXED,columnWidths:widths,margins:{top:80,bottom:80,left:110,right:110},borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows});
}
export async function buildProjectReport(data:ProjectReportSnapshot){
 const {project,tasks,members,files,coach}=data;
 const titleName=project.name.replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim()||"项目";
 const children:FileChild[]=[new Paragraph({text:`${titleName} 项目进展报告`,heading:HeadingLevel.TITLE}),paragraph(`生成时间：${when(data.generatedAt)}    导出人：${data.exporterName}`),paragraph(`当前共有 ${tasks.length} 项任务，已完成 ${data.completed} 项，整体完成度 ${data.completion}%，团队共有 ${members.length} 位成员。`),heading("项目概况"),paragraph(`项目名称：${project.name}`),paragraph(`项目 ID：${project.id}`),paragraph(`关联比赛：${project.competitionName||"暂无已核验赛事信息"}`),paragraph(`目标赛道：${project.trackName||"未设置"}`),paragraph(`招募状态：${project.status}    团队人数上限：${project.maxMembers===null?"未设置":project.maxMembers+" 人"}`),paragraph(`每周投入：${project.weeklyHours?project.weeklyHours+" 小时":"未设置"}`)];
 if(project.description.trim())project.description.split(/\r?\n/).filter(line=>line.trim()).forEach(line=>children.push(paragraph(line)));
 else children.push(paragraph("暂无项目简介。"));
 children.push(heading("成员架构"));
 if(members.length)children.push(table(["成员姓名","项目权限","技术标签","加入时间"],members.map(m=>[m.name||"未设置昵称",m.role,m.skills||"未填写",when(m.joinedAt)]),[2400,1400,3600,2346]));
 else children.push(paragraph("暂无成员信息。"));
 children.push(heading("待办进展"),paragraph(`共 ${tasks.length} 项任务，${tasks.length-data.completed} 项未完成。`,tasks.length>0));
 if(tasks.length)children.push(table(["待办事项","状态","优先级","负责人"],tasks.map(t=>[t.title,t.status,t.priority,t.assignee||"待分配"]),[5400,1600,900,1846]));
 else children.push(paragraph("暂无待办事项。"));
 children.push(heading("文档与代码目录"),paragraph(`共 ${files.filter(f=>f.kind==="document").length} 份文档和 ${files.filter(f=>f.kind==="code").length} 个代码文件。`,files.length>0));
 if(files.length)children.push(table(["文件路径","分区","版本","上传者","更新时间"],files.map(f=>[f.path,f.kind==="code"?"代码":"文档",`v${f.version}`,f.uploaderName||"未设置昵称",when(f.updatedAt)]),[4146,800,700,1750,2350]));
 else children.push(paragraph("暂无上传文档或代码。"));
 children.push(heading("AI 教练建议"));
 if(coach){children.push(paragraph(`建议生成时间：${when(coach.createdAt)}    来源：${coach.source}`));coach.summary.split(/\r?\n/).filter(line=>line.trim()).forEach(line=>children.push(paragraph(line)));}
 else children.push(paragraph("暂无已保存的 AI 教练建议。"));
 const doc=new Document({creator:"ProjectMate",title:`${project.name} 项目报告`,description:"项目进展、成员、待办与文件目录报告",styles:{default:{document:{run:{font,size:22,color:"182033"},paragraph:{spacing:{after:60,line:280}}}},paragraphStyles:[{id:"Title",name:"Title",basedOn:"Normal",next:"Normal",quickFormat:true,run:{font,size:34,bold:true,color:"000000"},paragraph:{spacing:{before:0,after:220},keepNext:true}},{id:"Heading1",name:"Heading 1",basedOn:"Normal",next:"Normal",quickFormat:true,run:{font,size:26,bold:true,color:"3525CD"},paragraph:{spacing:{before:220,after:100},keepNext:true,outlineLevel:0}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1080,bottom:1080,left:1080,right:1080}}},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({children:["第 ",PageNumber.CURRENT," 页"],size:18,color:"646477"})]})]})},children}]});
 return Packer.toBuffer(doc);
}
export function projectReportFilename(data:ProjectReportSnapshot){
 const parts=new Intl.DateTimeFormat("en",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(data.generatedAt);
 const value=(type:string)=>parts.find(part=>part.type===type)!.value;
 const date=`${value("year")}-${value("month")}-${value("day")}`;
 const name=Array.from(clean(data.project.name).replace(/[\\/:*?"<>|\u0000-\u001f]/g,"_")).slice(0,80).join("");
 return `${name}_项目报告_${date}.docx`;
}
