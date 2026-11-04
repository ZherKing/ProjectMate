import { revalidatePath } from "next/cache";
import { SiteShell, ToastNotice } from "@/components/layout/site-shell";
import { getLatestCoachReport, listProjectTasks, updateProjectTaskStatus } from "@/lib/db/tasks";
import { runProjectCoach } from "@/lib/ai/project-coach";

export const dynamic = "force-dynamic";

async function coachAction() {
  "use server";
  await runProjectCoach("demo-project");
  revalidatePath("/projects/tasks");
}

async function completeTaskAction(formData: FormData) {
  "use server";
  updateProjectTaskStatus(String(formData.get("taskId") ?? ""), "已完成");
  revalidatePath("/projects/tasks");
}

export default function ProjectTasksPage() {
  const tasks = listProjectTasks("demo-project");
  const report = getLatestCoachReport("demo-project");
  return <SiteShell><main className="pm-page"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="pm-eyebrow">PROJECT COACH</p><h1 className="pm-page-title">项目任务看板</h1><p className="pm-subtitle">AI 教练会读取任务状态，给出可执行的冲刺建议。</p></div><form action={coachAction}><button className="pm-button-primary">运行 AI 分析</button></form></div>{report && <section className="pm-panel mt-8 p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-indigo-700">最新教练建议</p><span className="text-xs text-slate-500">来源：{report.source}</span></div><p className="mt-3 leading-7 text-indigo-950">{report.summary}</p></section>}<div className="mt-8 grid gap-5 md:grid-cols-3">{["待分配", "进行中", "需紧急修复"].map((status) => <section key={status} className="pm-panel p-4"><h2 className="font-semibold">{status}</h2><div className="mt-4 space-y-3">{tasks.filter((task) => task.status === status).map((task) => <article key={task.id} className="pm-soft-panel p-4"><span className="font-mono text-xs text-slate-500">#{task.id}</span><h3 className="mt-2 text-sm font-semibold">{task.title}</h3><p className="mt-2 text-xs text-slate-500">{task.assignee || "待分配"} · 优先级 {task.priority}</p><form action={completeTaskAction} className="mt-3"><input type="hidden" name="taskId" value={task.id} /><button className="text-xs font-semibold text-indigo-600">标记为已完成</button></form></article>)}</div></section>)}</div></main><ToastNotice>任务状态和 AI 教练建议会保存到项目数据库</ToastNotice></SiteShell>;
}
