import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("项目概览：权限隔离、真实汇总、排序与刷新", async () => {
  const directory = mkdtempSync(join(tmpdir(), "projectmate-overview-test-"));
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
  const { sqlite } = await import("../src/lib/db/client");
  try {
    const { initializeDatabase } = await import("../src/lib/db/initialize");
    const { createRecruitmentProject } = await import("../src/lib/db/projects");
    const { getProjectOverview } = await import("../src/lib/db/project-overview");
    initializeDatabase();
    for (const id of ["owner", "stranger", "member1", "member2", "member3", "member4", "member5", "member6"]) {
      sqlite.prepare("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)").run(id, `${id}@test.invalid`, id, "unused", Date.now());
    }
    sqlite.prepare("INSERT INTO competitions(id,platform,name,status,source_url,updated_at,review_status) VALUES(?,?,?,?,?,?,?)").run("event", "测试来源", "测试赛事", "报名中", "https://test.invalid", Date.now(), "pending");
    const projectId = createRecruitmentProject({ creatorId: "owner", competitionId: "event", title: "真实汇总测试", description: "数据库项目说明", trackName: "自拟方向", weeklyHours: 12, roles: "前端开发" });
    for (let n=1;n<=6;n++) sqlite.prepare("INSERT INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(projectId, `member${n}`, n<=2 ? "管理员" : "成员", Date.now()+n);
    const priorities = ["低", "中", "高", "中", "低", "高", "高"];
    priorities.forEach((priority,index)=>sqlite.prepare("INSERT INTO project_tasks(id,project_id,title,notes,status,priority,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(`task${index}`, projectId, `任务${index}`, `备注${index}`, index===6 ? "已完成" : "待分配", priority, index));
    assert.equal(getProjectOverview(projectId,"stranger"), null);
    assert.equal(getProjectOverview("missing","owner"), null);
    const data = getProjectOverview(projectId,"member3");
    assert.ok(data);
    assert.equal(data.viewerRole,"成员");
    assert.equal(data.project.description,"数据库项目说明");
    assert.equal(data.project.weeklyHours,12);
    assert.equal(data.project.competitionName,null,"待审核赛事不伪装为已核验赛事");
    assert.equal(data.totalTasks,7);
    assert.equal(data.remaining,6);
    assert.deepEqual(data.tasks.map(t=>t.id),["task2","task5","task1","task3","task0"]);
    assert.equal(data.tasks[0].notes,"备注2");
    assert.equal(data.memberCount,7);
    assert.equal(data.members.length,5);
    assert.equal(data.members[0].role,"创建者");
    assert.equal(data.adminCount,2);
    sqlite.prepare("UPDATE competitions SET review_status='approved' WHERE id='event'").run();
    sqlite.prepare("UPDATE project_tasks SET status='已完成' WHERE id='task2'").run();
    sqlite.prepare("UPDATE project_members SET role='成员' WHERE project_id=? AND user_id='member1'").run(projectId);
    const refreshed = getProjectOverview(projectId,"owner");
    assert.equal(refreshed?.project.competitionName,"测试赛事");
    assert.equal(refreshed?.remaining,5);
    assert.equal(refreshed?.tasks[0].id,"task5");
    assert.equal(refreshed?.adminCount,1);
    sqlite.prepare("DELETE FROM project_members WHERE project_id=? AND user_id='member3'").run(projectId);
    assert.equal(getProjectOverview(projectId,"member3"),null);
    const emptyId = createRecruitmentProject({creatorId:"stranger",competitionId:"",title:"空项目",description:"",trackName:"",weeklyHours:0,roles:""});
    const empty = getProjectOverview(emptyId,"stranger");
    assert.ok(empty);
    assert.equal(empty.totalTasks,0);
    assert.deepEqual(empty.tasks,[]);
    assert.equal(empty.memberCount,1);
    assert.equal(empty.adminCount,0);
    assert.equal(empty.project.competitionName,null);
  } finally {
    sqlite.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL=previousUrl;
    rmSync(directory,{recursive:true,force:true});
  }
});
