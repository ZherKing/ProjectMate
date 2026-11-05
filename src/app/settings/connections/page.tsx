import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "外部连接与 MCP" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <DesignPage name="settings" settingsSection="connections" />;
}
