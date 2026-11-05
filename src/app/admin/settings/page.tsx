import { requireAdmin } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { getSiteSetting } from "@/lib/site-settings";
import { SiteShell } from "@/components/layout/site-shell";
import { AdminSettingsForm } from "@/components/layout/admin-settings-form";
export const metadata = { title: "网站设置" };
export const dynamic = "force-dynamic";
export default async function AdminSettingsPage() { if(!(await requireAdmin())) redirect("/login?next=/admin/settings"); return <SiteShell><main className="pm-page"><div className="pm-page-title">网站设置</div><p className="pm-subtitle">管理网站品牌信息和 SMTP 邮件服务。</p><AdminSettingsForm initial={{name:getSiteSetting("site.name")||"ProjectMate",icon:getSiteSetting("site.icon"),host:getSiteSetting("smtp.host"),port:getSiteSetting("smtp.port")||"587",secure:getSiteSetting("smtp.secure")==="true",user:getSiteSetting("smtp.user"),fromName:getSiteSetting("smtp.fromName")||"ProjectMate",fromEmail:getSiteSetting("smtp.fromEmail")}} /></main></SiteShell>; }
