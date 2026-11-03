import { SiteShell } from "@/components/layout/site-shell";
import { listProjectTasks } from "@/lib/db/tasks";

export const dynamic = "force-dynamic";

export default function ProjectTasksPage() {
  const tasks = listProjectTasks("demo-project");
  return <SiteShell><main className="mx-auto max-w-5xl px-6 py-10"><p className="text-sm font-semibold text-indigo-600">PROJECT TASKS</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">项目任务看板</h1><p className="mt-3 text-slate-600">任务数据已经接入 SQLite，后续 AI 教练会在这里创建和调整任务。</p><div className="mt-8 grid gap-5 md:grid-cols-3">{["待分配", "进行中", "需紧急修复"].map((status) => <section key={status} className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">{status}</h2><div className="mt-4 space-y-3">{tasks.filter((task) => task.status === status).map((task) => <article key={task.id} className="rounded-lg bg-slate-50 p-4"><span className="font-mono text-xs text-slate-500">#{task.id}</span><h3 className="mt-2 text-sm font-semibold">{task.title}</h3><p className="mt-2 text-xs text-slate-500">{task.assignee || "待分配"} · 优先级 {task.priority}</p></article>)}</div></section>)}</div></main></SiteShell>;
}
