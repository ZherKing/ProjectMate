import { SiteShell } from "@/components/layout/site-shell";
export const metadata={title:"MCP授权未完成"};
export default async function Page({searchParams}:{searchParams:Promise<{message?:string}>}) {const {message}=await searchParams;return <SiteShell><main className="pm-page"><section className="pm-panel pm-mcp-consent"><h1>授权未完成</h1><p>{typeof message==="string"?message.slice(0,300):"请从客户端重新发起连接。"}</p><a href="/projects" className="pm-button-outline">返回项目空间</a></section></main></SiteShell>;}
