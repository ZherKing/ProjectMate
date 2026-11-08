import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("项目成员：读取边界、角色保护、邀请和移除", async () => {
  const directory = mkdtempSync(join(tmpdir(), "projectmate-members-test-"));
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
  const { sqlite } = await import("../src/lib/db/client");
  try {
    const { initializeDatabase } = await import("../src/lib/db/initialize");
    const { getProjectAccess, getViewableProjectId, listProjectMembers, changeProjectMember } = await import("../src/lib/db/project-members");
    const { createRecruitmentProject, getAccessibleProjectId, createProjectInvite, acceptProjectInvite, getProjectStats, listRecruitmentProjects } = await import("../src/lib/db/projects");
    initializeDatabase();
    for (const id of ["owner", "admin", "other-admin", "member", "outside", "invitee"]) {
      sqlite.prepare("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)").run(id, `${id}@test.invalid`, id, "unused", Date.now());
    }
    const projectId = createRecruitmentProject({ creatorId: "owner", competitionId: "", trackName: "", title: "测试项目", description: "权限测试", roles: "", weeklyHours: 10 });
    const insert = sqlite.prepare("INSERT INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)");
    insert.run(projectId, "admin", "管理员", Date.now());
    insert.run(projectId, "other-admin", "管理员", Date.now());
    insert.run(projectId, "member", "成员", Date.now());
    sqlite.prepare("INSERT INTO project_tasks(id,project_id,title,status,priority,assignee,created_at) VALUES(?,?,?,?,?,?,?)").run("kept-task", projectId, "保留历史", "进行中", "中", "member", Date.now());
    assert.equal(getProjectAccess(projectId, "owner"), "创建者");
    assert.equal(getProjectAccess(projectId, "admin"), "管理员");
    assert.equal(getProjectAccess(projectId, "member"), "成员");
    assert.equal(getViewableProjectId("member", projectId), projectId);
    assert.equal(getViewableProjectId("outside", projectId), null);
    assert.equal(getAccessibleProjectId("member", projectId), null, "普通成员未获得原有写权限");
    assert.equal(listProjectMembers(projectId, "outside").length, 0);
    assert.equal(listProjectMembers(projectId, "owner").length, 4);
    const change = (actorId: string, memberId: string, operation: "role" | "remove", role?: string) => changeProjectMember({ actorId, memberId, operation, role, projectId });
    assert.equal(change("member", "admin", "remove").ok, false);
    assert.equal(change("outside", "member", "remove").ok, false);
    assert.equal(change("admin", "owner", "remove").ok, false);
    assert.equal(change("owner", "owner", "role", "成员").ok, false);
    assert.equal(change("admin", "other-admin", "remove").ok, false);
    assert.equal(change("admin", "member", "role", "管理员").ok, false);
    assert.equal(change("owner", "member", "role", "superuser").ok, false);
    assert.equal(change("owner", "member", "role", "管理员").ok, true);
    assert.equal(getProjectAccess(projectId, "member"), "管理员");
    const revokedToken = createProjectInvite(projectId, "member");
    assert.ok(revokedToken);
    assert.equal(change("owner", "member", "role", "成员").ok, true);
    assert.equal(acceptProjectInvite(revokedToken, "invitee").ok, false);
    assert.equal(createProjectInvite(projectId, "member"), null);
    const token = createProjectInvite(projectId, "admin");
    assert.ok(token);
    assert.equal(acceptProjectInvite(token, "invitee").ok, true);
    assert.equal(getProjectAccess(projectId, "invitee"), "成员");
    assert.equal(acceptProjectInvite(token, "outside").ok, false, "链接不能二次使用");
    const expired = createProjectInvite(projectId, "owner");
    sqlite.prepare("UPDATE project_invites SET expires_at=0 WHERE token=?").run(expired);
    assert.equal(acceptProjectInvite(expired!, "outside").ok, false);
    assert.equal(change("admin", "member", "remove").ok, true);
    assert.equal(getProjectAccess(projectId, "member"), null);
    assert.equal(getViewableProjectId("member", projectId), null);
    assert.equal(listProjectMembers(projectId, "member").length, 0);
    assert.ok(sqlite.prepare("SELECT id FROM users WHERE id='member'").get(), "账号保留");
    assert.ok(sqlite.prepare("SELECT id FROM project_tasks WHERE id='kept-task'").get(), "任务记录保留");
    const otherProject = createRecruitmentProject({ creatorId: "outside", competitionId: "", trackName: "", title: "另一个项目", description: "隔离验证", roles: "", weeklyHours: 10 });
    assert.equal(changeProjectMember({ actorId: "owner", memberId: "outside", projectId: otherProject, operation: "remove" }).ok, false);
    assert.equal(getProjectStats(projectId).memberCount, listProjectMembers(projectId, "owner").length);
    sqlite.prepare("DELETE FROM project_members WHERE project_id=? AND user_id='owner'").run(projectId);
    assert.equal(getProjectAccess(projectId, "owner"), "创建者", "历史项目缺创建者成员行时仍保留创建者权限");
    const actualCount = listProjectMembers(projectId, "owner").length;
    assert.equal(getProjectStats(projectId).memberCount, actualCount);
    assert.equal(listRecruitmentProjects().find(p => p.id === projectId)?.memberCount, actualCount);
    assert.ok(sqlite.prepare("SELECT id FROM admin_audit_logs WHERE action='project-member-remove'").get());
  } finally {
    sqlite.close();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    rmSync(directory, { recursive: true, force: true });
  }
});
