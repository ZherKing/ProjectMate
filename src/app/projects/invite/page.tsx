import{auth}from"@/auth";import{SiteShell}from"@/components/layout/site-shell";import{InvitationCard}from"@/components/projects/invitation-card";import{viewProjectInvitation}from"@/lib/db/project-invitations";
export const dynamic="force-dynamic";
export const metadata={title:"组队邀请"};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const user=(await auth())?.user,token=(await searchParams).token||"",invitation=viewProjectInvitation(token,user?.id);return <SiteShell><div className="pm-page pm-invitation-page"><InvitationCard invitation={invitation} token={token}/></div></SiteShell>;}
