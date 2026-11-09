import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "仪表盘" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DesignPage name="dashboard" />;
}
