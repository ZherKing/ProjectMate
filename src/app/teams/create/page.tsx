import { redirect } from "next/navigation";

export const metadata = { title: "发布组队项目" };

export default async function CreateTeamProjectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const competitionId = Array.isArray(query.competition) ? query.competition[0] : query.competition || "";
  redirect(`/teams?create=1${competitionId ? `&competition=${encodeURIComponent(competitionId)}` : ""}`);
}
