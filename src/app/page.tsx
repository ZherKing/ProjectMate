import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "首页" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <DesignPage name="home" />;
}
