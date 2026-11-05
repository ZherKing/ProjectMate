import { DesignPage } from "@/components/design/design-page";

export const metadata = { title: "注册" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <DesignPage name="login" variant="register" />;
}
