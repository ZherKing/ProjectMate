import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "安全与登录" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <DesignPage name="settings" settingsSection="security" />;
}
