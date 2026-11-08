import { DesignPage } from "@/components/design/design-page";
export const metadata = { title: "任务看板" };
export const dynamic = "force-dynamic";
export default function Page() { return <DesignPage name="projects" query={{ tab: "tasks" }} />; }
