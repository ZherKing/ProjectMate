import{auth}from"@/auth";import{redirect}from"next/navigation";import{SiteShell}from"@/components/layout/site-shell";import{DashboardPanel}from"@/components/dashboard/dashboard-panel";import{dashboardData}from"@/lib/db/dashboard";
export const metadata={title:"仪表盘"};export const dynamic="force-dynamic";
export default async function Page(){const user=(await auth())?.user;if(!user?.id)redirect("/login?next=/dashboard");const data=dashboardData(user.id);if(!data)redirect("/login?next=/dashboard");return <SiteShell><div className="pm-page"><DashboardPanel data={data}/></div></SiteShell>;}
