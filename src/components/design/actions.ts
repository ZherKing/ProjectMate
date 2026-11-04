"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { initializeDatabase } from "@/lib/db/initialize";
import { sqlite } from "@/lib/db/client";
import { createRecruitmentProject, applyToRecruitmentProject } from "@/lib/db/projects";
import { runProjectCoach } from "@/lib/ai/project-coach";
import { updateProjectTaskStatus } from "@/lib/db/tasks";
import { saveProfile } from "@/lib/db/profile";
import { requireAdmin } from "@/lib/auth/guards";
import { randomUUID } from "node:crypto";
import { isConfiguredAdminEmail } from "@/lib/auth/permissions";

type Payload = Record<string, string>;
export type ScreenResult = { ok: boolean; message: string; href?: string; summary?: string; id?: string };

export async function screenAction(action: string, data: Payload = {}): Promise<ScreenResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "登录后即可使用此功能", href: "/login" };
  initializeDatabase();
  try {
    switch (action) {
      case "apply": {
        const project = sqlite.prepare("SELECT creator_id AS creatorId, status FROM recruitment_projects WHERE id = ?").get(data.projectId) as { creatorId: string; status: string } | undefined;
        if (!project) return { ok: false, message: "此卡片为设计演示，请选择真实发布的项目后申请。" };
        if (project.creatorId === userId) return { ok: false, message: "这是你发布的项目，无需申请加入。" };
        if (project.status !== "招募中") return { ok: false, message: "该项目目前未开放招募。" };
        const exists = sqlite.prepare("SELECT id FROM team_applications WHERE project_id = ? AND applicant_id = ?").get(data.projectId, userId);
        if (exists) return { ok: false, message: "你已申请过该项目，请等待队长审核。" };
        applyToRecruitmentProject({ projectId: data.projectId, applicantId: userId });
        revalidatePath("/teams");
        return { ok: true, message: "申请已提交，等待队长审核。" };
      }
      case "favorite": {
        if (!data.key || data.key.length > 300) return { ok: false, message: "无法识别收藏项目。" };
        sqlite.exec("CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL, item_key TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id, item_key))");
        const exists = sqlite.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND item_key = ?").get(userId, data.key);
        if (exists) sqlite.prepare("DELETE FROM favorites WHERE user_id = ? AND item_key = ?").run(userId, data.key);
        else sqlite.prepare("INSERT INTO favorites VALUES (?, ?, ?)").run(userId, data.key, Date.now());
        return { ok: true, message: exists ? "已取消收藏" : "已收藏，可在比赛中心查看。" };
      }
      case "publish": {
        const title = (data.title || "").trim();
        const description = (data.description || "").trim();
        if (title.length < 2 || title.length > 100 || description.length < 5 || description.length > 5000) return { ok: false, message: "请填写项目名称（2—100字）与项目描述（5—5000字）。" };
        const competition = sqlite.prepare("SELECT id FROM competitions WHERE id = ?").get(data.competitionId) as { id: string } | undefined;
        if (!competition) return { ok: false, message: "请选择有效的目标比赛。" };
        const id = createRecruitmentProject({ creatorId: userId, competitionId: competition.id, trackName: (data.trackName || "").slice(0,100), title, description, roles: (data.roles || "").slice(0,500), weeklyHours: Math.max(1, Math.min(80, Number(data.weeklyHours) || 10)) });
        revalidatePath("/teams");
        return { ok: true, message: "项目已发布至组队大厅。", id };
      }
      case "coach": {
        const summary = await runProjectCoach("demo-project", (data.prompt || "").slice(0,2000));
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok: true, message: "分析完成，报告已保存。", summary };
      }
      case "complete-task": {
        const task = sqlite.prepare("SELECT id FROM project_tasks WHERE id = ? AND project_id = ?").get(data.taskId, "demo-project");
        if (!task) return { ok: false, message: "该任务是设计演示，尚未保存到任务数据库。" };
        updateProjectTaskStatus(data.taskId, "已完成");
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok: true, message: "任务已标记为完成。" };
      }
      case "save-profile": {
        saveProfile(userId, {
          school: (data.school || "").slice(0, 120),
          education: (data.education || "").slice(0, 120),
          roles: (data.roles || "").slice(0, 300),
          skills: (data.skills || "").slice(0, 1000),
          interests: (data.interests || "").slice(0, 1000),
          weeklyHours: Math.max(0, Math.min(168, Number(data.weeklyHours) || 0)),
        });
        revalidatePath("/settings"); revalidatePath("/profile");
        return { ok: true, message: "个人资料已保存。" };
      }
      case "review-competition": {
        const admin = await requireAdmin();
        if (!admin) return { ok: false, message: "没有管理员权限。", href: "/login?next=/admin" };
        const competitionId = (data.competitionId || "").trim();
        const decision = data.decision === "approved" ? "approved" : data.decision === "rejected" ? "rejected" : "";
        if (!competitionId || !decision) return { ok: false, message: "审核参数不完整。" };
        initializeDatabase();
        const competition = sqlite.prepare("SELECT id FROM competitions WHERE id = ? AND review_status = 'pending'").get(competitionId);
        if (!competition) return { ok: false, message: "赛事不存在或已被处理。" };
        const note = (data.note || "").slice(0, 500);
        const now = Date.now();
        sqlite.prepare("UPDATE competitions SET review_status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?").run(decision, admin.userId, now, note || null, competitionId);
        sqlite.prepare("INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), admin.userId, decision === "approved" ? "competition.approve" : "competition.reject", "competition", competitionId, note || "", now);
        revalidatePath("/admin"); revalidatePath("/competitions"); revalidatePath("/");
        return { ok: true, message: decision === "approved" ? "赛事已通过审核。" : "赛事已退回。" };
      }
      case "admin-set-role": {
        const admin = await requireAdmin();
        if (!admin) return { ok: false, message: "没有管理员权限。", href: "/login?next=/admin" };
        const targetId = (data.userId || "").trim();
        const role = data.role === "admin" ? "admin" : data.role === "user" ? "user" : "";
        if (!targetId || !role) return { ok: false, message: "角色参数不完整。" };
        const target = sqlite.prepare("SELECT id, email, role FROM users WHERE id = ?").get(targetId) as { id: string; email: string; role: string } | undefined;
        if (!target) return { ok: false, message: "用户不存在。" };
        if (role === "admin" && !isConfiguredAdminEmail(target.email)) return { ok: false, message: "只有 ADMIN_EMAILS 白名单账号可以设为管理员。" };
        if (target.id === admin.userId && role === "user") return { ok: false, message: "不能撤销当前登录管理员自己的权限。" };
        sqlite.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, target.id);
        const now = Date.now();
        sqlite.prepare("INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(randomUUID(), admin.userId, "user.role.update", "user", target.id, `${target.role} -> ${role}`, now);
        revalidatePath("/admin");
        return { ok: true, message: "用户角色已更新。" };
      }
      default: return { ok: false, message: "此功能尚在完善中，当前操作未修改数据。" };
    }
  } catch {
    return { ok: false, message: "操作未完成，请稍后重试。已有数据保持不变。" };
  }
}
