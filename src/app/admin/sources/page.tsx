import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "数据源与爬虫" };
export const dynamic = "force-dynamic";

export default function AdminSourcesPage() {
  return <DesignPage name="admin" adminSection="sources" />;
}
