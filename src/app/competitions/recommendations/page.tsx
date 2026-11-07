import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "AI 推荐赛事" };
export const dynamic = "force-dynamic";

export default function RecommendationsPage() {
  return <DesignPage name="competitions" query={{ tab: "recommendations" }} />;
}
