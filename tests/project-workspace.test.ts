import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync,strFromU8 } from "fflate";

test("项目设置与报告：人数、招募状态、项目选择、权限及Word内容",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"projectmate-workspace-test-")),previous={db:process.env.DATABASE_URL,storage:process.env.STORAGE_PATH};process.env.DATABASE_URL=`file:${join(directory,"test.sqlite")}`;process.env.STORAGE_PATH=join(directory,"storage");const{sqlite}=await import("../src/lib/db/client");
 try{
 const{initializeDatabase}=await import("../src/lib/db/initialize");initializeDatabase();
 const{createRecruitmentProject,createProjectInvite,acceptProjectInvite,applyToRecruitmentProject,listRecruitmentProjects,getAccessibleProjectId}=await import("../src/lib/db/projects");
 const{getViewableProjectId}=await import("../src/lib/db/project-members");const settings=await import("../src/lib/db/project-settings");const{saveProjectFile}=await import("../src/lib/files/store");const{projectReportSnapshot,buildProjectReport,projectReportFilename}=await import("../src/lib/reports/project-report");
 for(const id of ["owner","admin","member","fourth","fifth","outside"])sqlite.prepare("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)").run(id,`${id}@test.invalid`,id,"unused",Date.now());
 const input={creatorId:"owner",competitionId:"",trackName:"测试赛道",title:"报告 <测试> & 项目",description:"真实项目介绍",roles:"前端、后端",weeklyHours:12};
 const a=createRecruitmentProject(input),b=createRecruitmentProject({...input,title:"第二个项目"});const ownMember=createRecruitmentProject({...input,creatorId:"member",title:"成员自己的项目"});
 for(const[id,role]of [["admin","管理员"],["member","成员"]])sqlite.prepare("INSERT INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(a,id,role,Date.now());
 assert.equal(settings.getProjectSettings(a,"owner").memberCount,3);assert.equal(settings.getProjectSettings(a,"member").maxMembers,null);
 assert.equal(listRecruitmentProjects().find(p=>p.id===a)?.seatCount,null,"岗位标签不再推算人数");
 assert.throws(()=>settings.updateProjectSettings(a,"member",{maxMembers:4,status:"招募中"}),{status:403});
 assert.throws(()=>settings.updateProjectSettings(a,"outside",{maxMembers:4,status:"招募中"}),{status:403});
 for(const maximum of [0,1.5,1001,2])assert.throws(()=>settings.updateProjectSettings(a,"owner",{maxMembers:maximum,status:"招募中"}),settings.ProjectSettingsError);
 settings.updateProjectSettings(a,"admin",{maxMembers:4,status:"招募中"});assert.equal(listRecruitmentProjects().find(p=>p.id===a)?.seatCount,4);
 const first=createProjectInvite(a,"owner")!,second=createProjectInvite(a,"owner")!;assert.ok(first&&second);assert.equal(acceptProjectInvite(first,"fourth").ok,true);assert.equal(acceptProjectInvite(second,"fifth").ok,false);assert.equal(settings.projectMemberCount(a),4);assert.throws(()=>createProjectInvite(a,"admin"),settings.ProjectSettingsError);assert.throws(()=>applyToRecruitmentProject({projectId:a,applicantId:"fifth"}),settings.ProjectSettingsError);
 settings.updateProjectSettings(a,"owner",{maxMembers:5,status:"暂停招募"});assert.equal(acceptProjectInvite(second,"fifth").ok,false);assert.throws(()=>createProjectInvite(a,"owner"),settings.ProjectSettingsError);settings.updateProjectSettings(a,"owner",{maxMembers:5,status:"招募中"});assert.equal(acceptProjectInvite(second,"fifth").ok,true);
 settings.selectActiveProject("owner",a);assert.equal(getViewableProjectId("owner"),a);assert.equal(getViewableProjectId("owner",b),b);assert.equal(getViewableProjectId("owner"),a);assert.throws(()=>settings.selectActiveProject("owner",ownMember),{status:403});
 settings.selectActiveProject("member",a);assert.equal(getViewableProjectId("member"),a);assert.equal(getAccessibleProjectId("member"),null,"在加入项目中不错误操作另一个自有项目");assert.equal(getAccessibleProjectId("member",ownMember),ownMember);assert.equal(settings.listUserProjects("member").length,2);
 for(let i=0;i<3;i++)sqlite.prepare("INSERT INTO project_tasks(id,project_id,title,status,priority,created_at) VALUES(?,?,?,?,?,?)").run(`task${i}`,a,`真实待办${i}`,i===0?"已完成":"进行中","中",i);
 saveProjectFile({projectId:a,userId:"owner",kind:"document",path:"方案说明.md",bytes:Buffer.from("PRIVATE_FILE_CONTENT_NOT_IN_REPORT")});sqlite.prepare("INSERT INTO project_ai_reports(id,project_id,summary,source,created_at) VALUES(?,?,?,?,?)").run("report",a,"已保存建议内容","已保存来源",Date.now());
 assert.throws(()=>projectReportSnapshot(a,"outside"),{status:403});const snapshot=projectReportSnapshot(a,"member");assert.equal(snapshot.completion,33);assert.equal(snapshot.members.length,5);assert.equal(snapshot.project.maxMembers,5);
 const bytes=await buildProjectReport(snapshot);assert.equal(bytes.subarray(0,2).toString(),"PK");const zip=unzipSync(new Uint8Array(bytes)),xml=strFromU8(zip["word/document.xml"]);assert.ok(xml.includes("真实项目介绍"));assert.ok(xml.includes("报告 &lt;测试&gt; &amp; 项目"));assert.ok(xml.includes("真实待办2"));assert.ok(xml.includes("方案说明.md"));assert.ok(xml.includes("已保存建议内容"));assert.ok(!xml.includes("PRIVATE_FILE_CONTENT_NOT_IN_REPORT"));assert.ok(xml.includes("w:tblHeader"));assert.ok(xml.includes("w:type=\"fixed\""));assert.ok(strFromU8(zip["word/styles.xml"]).includes("Microsoft YaHei"));assert.ok(projectReportFilename(snapshot).endsWith(".docx"));assert.doesNotThrow(()=>encodeURIComponent(projectReportFilename({...snapshot,project:{...snapshot.project,name:"a".repeat(79)+"🤖"}})));
 sqlite.prepare("DELETE FROM project_members WHERE project_id=? AND user_id='member'").run(a);assert.equal(getViewableProjectId("member"),ownMember);assert.equal(getViewableProjectId("member",a),null);
 }finally{sqlite.close();for(const[key,value]of Object.entries({DATABASE_URL:previous.db,STORAGE_PATH:previous.storage})){if(value===undefined)delete process.env[key];else process.env[key]=value;}rmSync(directory,{recursive:true,force:true});}
});
