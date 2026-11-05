import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "用户管理" };
export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return <DesignPage name="admin" adminSection="users" />;
}
