import { DesignPage } from "@/components/design/design-page";

export const dynamic = "force-dynamic";

export default async function CompetitionDetailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DesignPage name="competitionDetail" query={await searchParams} />;
}
