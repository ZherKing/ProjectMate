import { auth } from "@/auth";
import { hasAdminRole } from "@/lib/auth/permissions";

export async function requireAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !hasAdminRole(userId)) return null;
  return { userId, email: session.user?.email ?? null };
}
