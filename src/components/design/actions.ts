"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { initializeDatabase } from "@/lib/db/initialize";
import { sqlite } from "@/lib/db/client";
import { createRecruitmentProject, applyToRecruitmentProject, addProjectTask, createProjectInvite, getAccessibleProjectId, updateProjectNickname } from "@/lib/db/projects";
import { runProjectCoach } from "@/lib/ai/project-coach";
import { updateProjectTaskStatus } from "@/lib/db/tasks";
import { saveProfile } from "@/lib/db/profile";
import { requireAdmin } from "@/lib/auth/guards";
import { randomUUID } from "node:crypto";
import { isConfiguredAdminEmail } from "@/lib/auth/permissions";
import { getCompetition, getCompetitionTrackDetails } from "@/lib/db/queries";
import { analyzeCompetitionTrack, generateRecruitmentDraft, generateRecruitmentCopy } from "@/lib/ai/website-ai";
import { isAiConfigured } from "@/lib/ai/provider";
import { consumeAiQuota } from "@/lib/ai/limits";
import { getCompetitionAnalysis } from "@/lib/ai/analysis-cache";
import { changeProjectMember, getViewableProjectId } from "@/lib/db/project-members";

type Payload = Record<string, string>;
export type ScreenResult = { ok: boolean; message: string; href?: string; summary?: string; generatedText?: string; generatedTitle?: string; generatedAt?: string; id?: string };

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
        if(!isAiConfigured())return {ok:false,message:"AI_API_KEY 尚未配置。请在服务器 .env 或 .env.local 文件中配置 DeepSeek 后再试。"};
        const projectId = getAccessibleProjectId(userId, data.projectId);
        if (!projectId) return { ok: false, message: "当前账号还没有可分析的项目任务。请先创建项目并添加任务。" };
        if(!consumeAiQuota(userId,"project-coach"))return {ok:false,message:"AI 教练请求较频繁，请 10 分钟后再试。"};
        const summary = await runProjectCoach(projectId, userId, (data.prompt || "").slice(0,2000));
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok: true, message: "分析完成，报告已保存。", summary };
      }
      case "analyze-competition": {
        if(!isAiConfigured())return {ok:false,message:"AI_API_KEY 尚未配置。请在服务器 .env 或 .env.local 文件中配置 DeepSeek 后再试。"};
        const id=(data.competitionId||"").trim();
        const competition=getCompetition(id);
        if(!competition)return {ok:false,message:"赛事不存在或尚未通过审核。"};
        const tracks=getCompetitionTrackDetails(id);
        const index=Math.max(0,Math.min(tracks.length-1,Number(data.trackIndex)||0));
        const track=tracks[index];
        if(!track)return {ok:false,message:"本站尚无可分析的赛道资料。请以赛事官方页面为准。"};
        const cached=getCompetitionAnalysis(id,track.id,competition.updatedAt);
        if(cached)return {ok:true,message:"已读取基于当前赛事资料生成的分析。",summary:cached.analysis,generatedAt:String(cached.generatedAt)};
        if(!consumeAiQuota(userId,"competition-analysis"))return {ok:false,message:"AI 分析请求较频繁，请 10 分钟后再试。"};
        const analysis=await analyzeCompetitionTrack({...competition,competitionId:id,trackId:track.id,sourceUpdatedAt:competition.updatedAt,competitionName:competition.name,trackName:track.name,description:track.description,deadline:track.deadline});
        return {ok:true,message:"分析已根据本站审核过的赛事资料生成。请以官方来源为准。",summary:analysis};
      }
      case "generate-team-copy": {
        if(!isAiConfigured())return {ok:false,message:"AI_API_KEY 尚未配置。请在服务器 .env 或 .env.local 文件中配置 DeepSeek 后再试。"};
        const title=(data.title||"").trim();const description=(data.description||"").trim();const competitionName=(data.competitionName||"").trim();
        if(title.length<2&&competitionName.length<2)return {ok:false,message:"请先选择关联比赛，或填写项目名称后再生成招募文案。"};
        if(!consumeAiQuota(userId,"team-recruitment-copy"))return {ok:false,message:"AI 文案生成请求较频繁，请 10 分钟后再试。"};
        const draft=await generateRecruitmentDraft({title:title||competitionName,description,competitionName,trackName:(data.trackName||"").slice(0,160),roles:(data.roles||"").slice(0,500)});
        return {ok:true,message:"已根据关联比赛生成项目草稿，可编辑后再发布。",generatedText:draft.description,generatedTitle:draft.title};
      }
      case "complete-task": {
        const projectId = getAccessibleProjectId(userId, data.projectId);
        const task = projectId ? sqlite.prepare("SELECT id FROM project_tasks WHERE id = ? AND project_id = ?").get(data.taskId, projectId) : null;
        if (!task) return { ok: false, message: "该任务是设计演示，尚未保存到任务数据库。" };
        updateProjectTaskStatus(data.taskId, "已完成");
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok: true, message: "任务已标记为完成。" };
      }
      case "update-project-nickname": {
        const projectId = getAccessibleProjectId(userId, data.projectId);
        if (!projectId) return { ok: false, message: "当前账号没有可编辑的项目。" };
        const nickname = (data.nickname || "").trim();
        if (nickname.length < 2) return { ok: false, message: "项目昵称至少需要 2 个字。" };
        if (!updateProjectNickname(projectId, userId, nickname)) return { ok: false, message: "项目昵称保存失败。" };
        revalidatePath("/projects");
        return { ok: true, message: "项目昵称已保存。" };
      }
      case "create-project-task": {
        const projectId = getAccessibleProjectId(userId, data.projectId);
        if (!projectId) return { ok: false, message: "当前账号没有可编辑的项目。" };
        const title = (data.title || "").trim();
        if (title.length < 2) return { ok: false, message: "请填写任务名称。" };
        const id = addProjectTask(projectId, userId, { title, priority: data.priority === "高" ? "高" : data.priority === "低" ? "低" : "中", assignee: data.assignee || "" });
        if (!id) return { ok: false, message: "任务创建失败。" };
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok: true, message: "任务已创建。", id };
      }
      case "save-todo":
      case "toggle-todo": {
        const projectId = getAccessibleProjectId(userId, data.projectId);
        if (!projectId) return { ok: false, message: "没有当前项目的编辑权限。" };
        if (action === "toggle-todo") {
          const result = sqlite.prepare("UPDATE project_tasks SET status=? WHERE id=? AND project_id=?").run(data.completed === "true" ? "已完成" : "待分配", data.taskId, projectId);
          if (!result.changes) return { ok:false, message:"待办不存在或无权修改。" };
        } else {
          const title = (data.title || "").trim(), notes = (data.notes || "").trim();
          if (!title || title.length > 160 || notes.length > 1000) return { ok:false, message:"标题需为 1—160 字，备注最多 1000 字。" };
          if (data.taskId) {
            const result = sqlite.prepare("UPDATE project_tasks SET title=?, notes=? WHERE id=? AND project_id=?").run(title, notes, data.taskId, projectId);
            if (!result.changes) return { ok:false, message:"待办不存在或无权修改。" };
          } else sqlite.prepare("INSERT INTO project_tasks(id,project_id,title,notes,status,priority,created_at) VALUES(?,?,?,?,?,?,?)").run(randomUUID(),projectId,title,notes,"待分配","中",Date.now());
        }
        revalidatePath("/projects"); revalidatePath("/projects/tasks");
        return { ok:true, message:"待办已保存。" };
      }
      case "create-project-invite": {
        const projectId = getViewableProjectId(userId, data.projectId);
        if (!projectId) return { ok: false, message: "当前账号没有可邀请成员的项目。" };
        const token = createProjectInvite(projectId, userId);
        if (!token) return { ok: false, message: "只有创建者或管理员可以邀请成员。" };
        return { ok: true, message: "邀请链接已生成。", href: "/projects/invite?token=" + token };
      }
      case "change-project-member-role":
      case "remove-project-member": {
        if (!data.projectId || !data.memberId) return { ok: false, message: "无法识别项目或成员，请刷新后重试。" };
        const result = changeProjectMember({ projectId: data.projectId, actorId: userId, memberId: data.memberId,
          operation: action === "remove-project-member" ? "remove" : "role", role: data.role });
        if (result.ok) {
          revalidatePath("/projects"); revalidatePath("/projects/tasks"); revalidatePath("/projects/members"); revalidatePath("/teams");
        }
        return result;
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
        revalidatePath("/admin"); revalidatePath("/admin/logs"); revalidatePath("/competitions"); revalidatePath("/");
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
        revalidatePath("/admin/users");
        revalidatePath("/admin/logs");
        return { ok: true, message: "用户角色已更新。" };
      }
      default: return { ok: false, message: "此功能尚在完善中，当前操作未修改数据。" };
    }
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, message: "DeepSeek 请求超时，请检查服务状态后重试。" };
    const detail = error instanceof Error ? error.message.toLowerCase() : "";
    if (/insufficient balance|余额不足|402/.test(detail)) return { ok: false, message: "DeepSeek 账户余额不足，请充值或更换可用的 API Key 后重试。" };
    if (/invalid.?api.?key|authentication|unauthorized|401/.test(detail)) return { ok: false, message: "DeepSeek API Key 无效或已失效，请检查服务器环境配置。" };
    if (/model.*not found|模型不存在|404/.test(detail)) return { ok: false, message: "DeepSeek 模型不可用，请将 AI_MODEL 设置为账号支持的模型，例如 deepseek-chat。" };
    if (["coach", "analyze-competition", "generate-team-copy"].includes(action)) return { ok: false, message: "DeepSeek 服务调用失败，请检查服务器 .env 中的 API Key、Base URL 和模型名称后重试。" };
    return { ok: false, message: "操作未完成，请稍后重试。已有数据保持不变。" };
  }
}
