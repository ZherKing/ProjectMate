import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "项目空间" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DesignPage name="projects" />;
}
