import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "个人设置" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  return <DesignPage name="settings" />;
}
