import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "组队大厅" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DesignPage name="teams" />;
}
