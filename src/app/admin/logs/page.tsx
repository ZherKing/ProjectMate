import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "操作日志" };
export const dynamic = "force-dynamic";

export default function AdminLogsPage() {
  return <DesignPage name="admin" adminSection="logs" />;
}
