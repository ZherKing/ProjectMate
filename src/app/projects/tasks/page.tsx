import { revalidatePath } from "next/cache";
import { SiteShell, ToastNotice } from "@/components/layout/site-shell";
import { getLatestCoachReport, listProjectTasks, updateProjectTaskStatus } from "@/lib/db/tasks";
import { runProjectCoach } from "@/lib/ai/project-coach";
import { auth } from "@/auth";
import { isAiConfigured } from "@/lib/ai/provider";
import { consumeAiQuota } from "@/lib/ai/limits";
import { getAccessibleProjectId } from "@/lib/db/projects";

export const metadata = { title: "项目任务看板" };
export const dynamic = "force-dynamic";

async function coachAction() {
  "use server";
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !isAiConfigured() || !consumeAiQuota(userId, "project-coach")) return;
  const projectId = getAccessibleProjectId(userId);
  if (projectId) await runProjectCoach(projectId);
  revalidatePath("/projects/tasks");
}

async function completeTaskAction(formData: FormData) {
  "use server";
  const session = await auth();
  const projectId = session?.user?.id ? getAccessibleProjectId(session.user.id, String(formData.get("projectId") ?? "")) : null;
  if (!projectId) return;
  const taskId = String(formData.get("taskId") ?? "");
  const task = listProjectTasks(projectId).find((item) => item.id === taskId);
  if (task) updateProjectTaskStatus(taskId, "已完成");
  revalidatePath("/projects/tasks");
}

export default async function ProjectTasksPage() {
  const session = await auth();
  const projectId = session?.user?.id ? getAccessibleProjectId(session.user.id) : null;
  const tasks = projectId ? listProjectTasks(projectId) : [];
  const report = projectId ? getLatestCoachReport(projectId) : undefined;
  return <SiteShell><main className="pm-page"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="pm-eyebrow">PROJECT COACH</p><h1 className="pm-page-title">项目任务看板</h1><p className="pm-subtitle">AI 教练会读取当前项目任务，给出可执行的冲刺建议。</p></div>{projectId && <div className="flex flex-col items-end gap-2"><form action={coachAction}><button className="pm-button-primary">运行 AI 分析</button></form>{!isAiConfigured() && <span className="text-xs text-amber-700">请先在服务器 .env 配置 AI_API_KEY</span>}</div>}</div>{!projectId && <section className="pm-panel mt-8 p-6"><h2 className="font-semibold">暂无可分析项目</h2><p className="mt-2 text-sm text-slate-600">先创建一个组队项目并添加任务，AI 教练才能基于真实数据分析。</p></section>}{report && <section className="pm-panel mt-8 p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-indigo-700">最新教练建议</p><span className="text-xs text-slate-500">来源：{report.source}</span></div><p className="mt-3 leading-7 text-indigo-950">{report.summary}</p></section>}<div className="mt-8 grid gap-5 md:grid-cols-3">{["待分配", "进行中", "需紧急修复"].map((status) => <section key={status} className="pm-panel p-4"><h2 className="font-semibold">{status}</h2><div className="mt-4 space-y-3">{tasks.filter((task) => task.status === status).map((task) => <article key={task.id} className="pm-soft-panel p-4"><span className="font-mono text-xs text-slate-500">#{task.id}</span><h3 className="mt-2 text-sm font-semibold">{task.title}</h3><p className="mt-2 text-xs text-slate-500">{task.assignee || "待分配"} · 优先级 {task.priority}</p><form action={completeTaskAction} className="mt-3"><input type="hidden" name="taskId" value={task.id} /><input type="hidden" name="projectId" value={projectId || ""} /><button className="text-xs font-semibold text-indigo-600">标记为已完成</button></form></article>)}</div></section>)}</div></main><ToastNotice>任务状态和 AI 教练建议会保存到项目数据库</ToastNotice></SiteShell>;
}
