import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "组队大厅" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DesignPage name="teams" query={await searchParams} />;
}
