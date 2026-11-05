import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { seedDatabase } from "@/lib/db/seed";
import { verifyPassword } from "@/lib/auth/password";
import { syncConfiguredUserRole } from "@/lib/auth/permissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? "projectmate-development-secret",
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        initializeDatabase();
        const account = sqlite.prepare("SELECT name FROM users WHERE id = ?").get(token.sub) as { name: string | null } | undefined;
        if (account) session.user.name = account.name;
        const avatar = sqlite.prepare("SELECT updated_at AS version FROM user_avatars WHERE user_id = ?").get(token.sub) as { version: number } | undefined;
        session.user.image = avatar ? `/api/avatars/${encodeURIComponent(token.sub)}?v=${avatar.version}` : null;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        initializeDatabase();
        seedDatabase();
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const user = sqlite.prepare(
          "SELECT id, email, name, password_hash AS passwordHash FROM users WHERE email = ?",
        ).get(email) as { id: string; email: string; name: string | null; passwordHash: string } | undefined;
        if (!user || !verifyPassword(password, user.passwordHash)) return null;
        syncConfiguredUserRole(user.id, user.email);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
