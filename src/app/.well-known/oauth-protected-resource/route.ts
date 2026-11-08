import { publicOrigin, resourceUrl } from "@/lib/mcp/oauth";
export const dynamic = "force-dynamic";
export function GET() { return Response.json({ resource: resourceUrl(), resource_name: "ProjectMate 项目文件", authorization_servers: [publicOrigin()], scopes_supported: ["files:read","files:write"], bearer_methods_supported: ["header"] }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }); }
