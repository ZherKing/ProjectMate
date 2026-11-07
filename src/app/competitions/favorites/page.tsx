import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "我的赛事收藏" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  return <DesignPage name="favorites" query={{ tab: tab === "recommendations" ? "recommendations" : "favorites" }} />;
}
