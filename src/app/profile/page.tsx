import { auth } from "@/auth";
import { SiteShell, ToastNotice } from "@/components/layout/site-shell";
import { getProfile, saveProfile } from "@/lib/db/profile";

export const dynamic = "force-dynamic";

async function saveProfileAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) return;
  saveProfile(session.user.id, {
    school: String(formData.get("school") ?? ""),
    education: String(formData.get("education") ?? ""),
    roles: String(formData.get("roles") ?? ""),
    skills: String(formData.get("skills") ?? ""),
    interests: String(formData.get("interests") ?? ""),
    weeklyHours: Number(formData.get("weeklyHours") ?? 0),
  });
}

export default async function ProfilePage() {
  const session = await auth();
  const profile = session?.user?.id ? getProfile(session.user.id) : undefined;
  return <SiteShell><main className="mx-auto max-w-4xl px-6 py-10"><p className="text-sm font-semibold text-indigo-600">PROFILE BUILDER</p><h1 className="mt-3 text-4xl font-extrabold tracking-tight">完善你的能力画像</h1><p className="mt-3 text-slate-600">画像越完整，比赛推荐和队友匹配越准确。</p><form action={saveProfileAction} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><Field label="学校" name="school" value={profile?.school ?? ""} placeholder="例如：浙江大学" /><Field label="学历" name="education" value={profile?.education ?? ""} placeholder="本科 / 硕士 / 博士" /><Field label="期望角色" name="roles" value={profile?.roles ?? ""} placeholder="前端开发、产品负责人" /><Field label="每周可投入时间" name="weeklyHours" value={String(profile?.weeklyHours ?? 10)} placeholder="10" type="number" /></div><label className="mt-5 block text-sm font-medium">技能标签<textarea name="skills" defaultValue={profile?.skills ?? ""} placeholder="React, TypeScript, AI Agent, 产品设计" className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><label className="mt-5 block text-sm font-medium">感兴趣的方向<textarea name="interests" defaultValue={profile?.interests ?? ""} placeholder="AI 应用、校园创新、数据分析" className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label><button className="mt-7 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">保存能力画像</button></form></main><ToastNotice>保存后将更新你的比赛推荐和队友匹配</ToastNotice></SiteShell>;
}

function Field({ label, name, value, placeholder, type = "text" }: { label: string; name: string; value: string; placeholder: string; type?: string }) {
  return <label className="block text-sm font-medium">{label}<input name={name} type={type} defaultValue={value} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-600" /></label>;
}
