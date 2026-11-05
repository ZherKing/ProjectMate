import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "通知偏好" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <DesignPage name="settings" settingsSection="notifications" />;
}
