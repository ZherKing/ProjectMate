import {scheduleNotifications} from "@/lib/notifications/schedule";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { acceptProjectInvite } from "@/lib/db/projects";
import { SiteShell } from "@/components/layout/site-shell";

export const dynamic = "force-dynamic";

export default async function ProjectInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const session = await auth();
  const token = (await searchParams).token || "";
  if (!session?.user?.id) redirect(`/login?next=${encodeURIComponent(`/projects/invite?token=${token}`)}`);
  const result = token ? acceptProjectInvite(token, session.user.id) : { ok: false, message: "邀请链接缺少 token。" };
  if(result.ok)scheduleNotifications();
  return <SiteShell><main className="pm-page"><section className="pm-panel mx-auto max-w-xl p-8 text-center"><h1 className="pm-section-title">{result.ok ? "已加入项目" : "无法加入项目"}</h1><p className="mt-3 text-sm text-slate-600">{result.ok ? "你现在可以在项目空间查看该项目并参与任务协作。" : result.message}</p><a className="pm-button-primary mt-6" href={result.ok ? `/projects/members?project=${encodeURIComponent(result.projectId!)}` : "/teams"}>{result.ok ? "进入项目空间" : "返回组队大厅"}</a></section></main></SiteShell>;
}
