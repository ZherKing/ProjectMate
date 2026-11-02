import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { signIn } from "@/auth";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { hashPassword } from "@/lib/auth/password";

async function registerAction(formData: FormData) {
  "use server";
  initializeDatabase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !name || password.length < 8) redirect("/register?error=invalid");
  const exists = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) redirect("/register?error=exists");
  sqlite.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), email, name, hashPassword(password), Date.now());
  await signIn("credentials", { email, password, redirectTo: "/profile" });
}

export default function RegisterPage() {
  return <SiteShell><main className="mx-auto flex min-h-[calc(100vh-128px)] max-w-[1280px] items-center justify-center px-6 py-16"><form action={registerAction} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-10 shadow-xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">ProjectMate</p><h1 className="mt-4 text-3xl font-extrabold">创建你的项目档案</h1><p className="mt-2 text-sm text-slate-500">注册后完善能力画像，获得比赛和队友推荐。</p><label className="mt-8 block text-sm font-medium">昵称<input name="name" required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><label className="mt-5 block text-sm font-medium">邮箱<input name="email" type="email" required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><label className="mt-5 block text-sm font-medium">密码<input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><button className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">创建账号</button><p className="mt-6 text-center text-sm text-slate-500">已有账号？ <a href="/login" className="font-semibold text-indigo-600">立即登录</a></p></form></main></SiteShell>;
}
