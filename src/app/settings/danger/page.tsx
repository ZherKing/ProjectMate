import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "危险操作" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <DesignPage name="settings" settingsSection="danger" />;
}
