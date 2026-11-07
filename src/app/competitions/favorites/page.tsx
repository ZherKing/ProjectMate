import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "我的赛事收藏" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  return <DesignPage name="favorites" query={{ tab: "favorites" }} />;
}
