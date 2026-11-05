import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteShell } from "@/components/layout/site-shell";
import { createRecruitmentProject } from "@/lib/db/projects";

export const metadata = { title: "发布组队项目" };

async function createProjectAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  createRecruitmentProject({
    creatorId: session.user.id,
    competitionId: String(formData.get("competitionId") ?? ""),
    trackName: String(formData.get("trackName") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    roles: String(formData.get("roles") ?? ""),
    weeklyHours: Number(formData.get("weeklyHours") ?? 0),
  });
  redirect("/teams?created=1");
}

export default function CreateTeamProjectPage() {
  return <SiteShell><main className="mx-auto max-w-3xl px-6 py-10"><p className="text-sm font-semibold text-indigo-600">AI PROJECT RECRUIT</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">发布组队项目</h1><p className="mt-3 text-slate-600">填写基础想法，后续由 AI 生成招募文案、角色建议和项目计划。</p><form action={createProjectAction} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><label className="block text-sm font-medium">项目名称<input name="title" required placeholder="例如：校园 AI 智能导师" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" /></label><div className="mt-5 grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">目标比赛<select name="competitionId" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3"><option value="c4-ai-2025">全球 AI 智能体应用创新大赛</option><option value="ccf-bdci-2025">CCF 大数据与计算智能大赛</option></select></label><label className="text-sm font-medium">目标赛道<input name="trackName" defaultValue="AI 原生应用赛道" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3" /></label></div><label className="mt-5 block text-sm font-medium">一句话项目描述<textarea name="description" required className="mt-2 min-h-32 w-full rounded-lg border border-slate-300 px-4 py-3" placeholder="我们想解决什么问题？"></textarea></label><label className="mt-5 block text-sm font-medium">招募角色<input name="roles" placeholder="前端开发、算法工程师、产品经理" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" /></label><label className="mt-5 block text-sm font-medium">每周投入时间<input name="weeklyHours" type="number" min="1" defaultValue="10" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" /></label><button className="mt-7 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">发布并进入组队大厅</button></form></main></SiteShell>;
}
