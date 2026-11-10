import { consumeCaptcha } from "@/lib/security/geetest";
import { requireSameOrigin } from "@/lib/files/http";
import { securityBody, securityFailure } from "@/lib/security/http";
import { sessionTicket,limitSecurity } from "@/lib/security/service";
import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await securityBody(request);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 128 || email.length > 254) {
      return NextResponse.json({ ok: false, message: "请填写有效昵称、邮箱和至少 8 位密码。" }, { status: 400 });
    }
    consumeCaptcha(body.captchaTicket,"register",email);
    limitSecurity("register:"+email,10,60000);
    initializeDatabase();
    const exists = sqlite.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (exists) return NextResponse.json({ ok: false, message: "该邮箱已经注册，请直接登录。" }, { status: 409 });
    const userId=crypto.randomUUID();
    sqlite.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(userId, email, name.slice(0,100), hashPassword(password), Date.now());
    return NextResponse.json({ ok: true, ticket:sessionTicket(userId) },{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    return securityFailure(error);
  }
}
