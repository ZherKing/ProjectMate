import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "管理后台" };
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <DesignPage name="admin" />;
}
