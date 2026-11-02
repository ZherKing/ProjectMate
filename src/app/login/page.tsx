import { signIn } from "@/auth";
import { SiteShell } from "@/components/layout/site-shell";

async function loginAction(formData: FormData) {
  "use server";
  await signIn("credentials", {
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: "/dashboard",
  });
}

export default function LoginPage() {
  return <SiteShell><main className="mx-auto flex min-h-[calc(100vh-128px)] max-w-[1280px] items-center justify-center px-6 py-16"><div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-2"><div className="bg-indigo-600 p-10 text-white"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-100">ProjectMate</p><h1 className="mt-16 text-4xl font-extrabold leading-tight">让下一个想法，找到合适的队伍。</h1><p className="mt-6 leading-7 text-indigo-100">登录后解锁 AI 比赛推荐、队友匹配和项目协作工作台。</p></div><form action={loginAction} className="p-10"><h2 className="text-2xl font-bold">登录你的工作台</h2><p className="mt-2 text-sm text-slate-500">演示账号：demo@projectmate.local / projectmate-demo</p><label className="mt-8 block text-sm font-medium">邮箱地址<input name="email" type="email" defaultValue="demo@projectmate.local" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><label className="mt-5 block text-sm font-medium">密码<input name="password" type="password" defaultValue="projectmate-demo" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><button type="submit" className="mt-7 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">登录并进入仪表盘</button><p className="mt-6 text-center text-sm text-slate-500">还没有账号？ <a href="/register" className="font-semibold text-indigo-600">免费注册</a></p></form></div></main></SiteShell>;
}
