import { initializeDatabase } from "@/lib/db/initialize";
import { sqlite } from "@/lib/db/client";

export type UserRole = "user" | "admin";

export function isConfiguredAdminEmail(email: string) {
  return new Set((process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))
    .has(email.trim().toLowerCase());
}

function configuredAdminEmails() {
  return new Set((process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean));
}

export function syncConfiguredUserRole(userId: string, email: string) {
  initializeDatabase();
  const role: UserRole = configuredAdminEmails().has(email.trim().toLowerCase()) ? "admin" : "user";
  sqlite.prepare("UPDATE users SET role = ? WHERE id = ? AND deleted_at IS NULL").run(role, userId);
}

export function getUserRole(userId: string): UserRole | null {
  initializeDatabase();
  const user = sqlite.prepare("SELECT role FROM users WHERE id = ? AND deleted_at IS NULL").get(userId) as { role: string } | undefined;
  if (user?.role === "user" || user?.role === "admin") return user.role;
  return null;
}

export function hasAdminRole(userId: string): boolean {
  initializeDatabase();
  const user = sqlite.prepare("SELECT email, role FROM users WHERE id = ? AND deleted_at IS NULL").get(userId) as { email: string; role: string } | undefined;
  if (!user || user.role !== "admin") return false;
  return configuredAdminEmails().has(user.email.trim().toLowerCase());
}
