import { DesignPage } from "@/components/design/design-page";
export const metadata = { title: "网站设置" };
export const dynamic = "force-dynamic";
export default function AdminSettingsPage() { return <DesignPage name="admin" adminSection="settings" />; }
