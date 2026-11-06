import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteShell } from "@/components/layout/site-shell";
import { createRecruitmentProject } from "@/lib/db/projects";
import { teamCreateModalTemplate } from "@/design/team-create-modal-template";
import { TeamCreateModalBehavior } from "@/components/layout/team-create-modal-behavior";

export const metadata = { title: "发布组队项目" };

async function createProjectAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  createRecruitmentProject({ creatorId: session.user.id, competitionId: String(formData.get("competitionId") ?? ""), trackName: String(formData.get("trackName") ?? ""), title: String(formData.get("title") ?? ""), description: String(formData.get("description") ?? ""), roles: String(formData.get("roles") ?? ""), weeklyHours: Number(formData.get("weeklyHours") ?? 0) });
  redirect("/teams?created=1");
}

export default async function CreateTeamProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const competitionId = Array.isArray(query.competition) ? query.competition[0] : query.competition || "";
  const html = teamCreateModalTemplate.replaceAll('data-competition-id="9cc9d6cc2bc420c2e423f62c"', `data-competition-id="${competitionId}"`).replace(/id="modal-submit-btn" type="button"/, 'id="modal-submit-btn" type="submit"');
  return <SiteShell><main className="relative min-h-[calc(100vh-64px)]"><div className="pointer-events-none select-none opacity-40 blur-[1px] min-h-[calc(100vh-64px)] bg-surface" /><div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"><form action={createProjectAction} className="contents"><input type="hidden" name="competitionId" value={competitionId} /><input type="hidden" name="roles" value="" /><div dangerouslySetInnerHTML={{ __html: html }} /></form></div><TeamCreateModalBehavior /></main></SiteShell>;
}
