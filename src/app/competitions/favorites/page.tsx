import { DesignPage } from "@/components/design/design-page";

export const dynamic = "force-dynamic";

export default function FavoriteCompetitionsPage() {
  return <DesignPage name="competitions" query={{ tab: "favorites" }} />;
}
