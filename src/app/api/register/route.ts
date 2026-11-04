import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return NextResponse.json({ ok: false, message: "请填写有效昵称、邮箱和至少 8 位密码。" }, { status: 400 });
    }
    initializeDatabase();
    const exists = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (exists) return NextResponse.json({ ok: false, message: "该邮箱已经注册，请直接登录。" }, { status: 409 });
    sqlite.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(crypto.randomUUID(), email, name, hashPassword(password), Date.now());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "注册服务暂时不可用，请稍后重试。" }, { status: 500 });
  }
}
