import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcp, OAuthError, publicOrigin, rateLimit } from "@/lib/mcp/oauth";
import { createProjectMcpServer } from "@/lib/mcp/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function cors(request: Request): Record<string,string> {
  const origin = request.headers.get("origin");
  const allowed = new Set([publicOrigin(), ...(process.env.MCP_ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean)]);
  if (origin && !allowed.has(origin)) throw new OAuthError("access_denied","MCP请求来源不在白名单。",403);
  const host = request.headers.get("host");
  if (host && host !== new URL(publicOrigin()).host) throw new OAuthError("access_denied","MCP请求Host与AUTH_URL不一致。",403);
  return origin ? { "Access-Control-Allow-Origin":origin,"Access-Control-Allow-Methods":"POST, GET, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id","Access-Control-Expose-Headers":"WWW-Authenticate, MCP-Session-Id","Vary":"Origin" } : {};
}
async function handle(request: Request) {
  let headers: Record<string,string> = {};
  try {
    headers = cors(request);
    const grant = authenticateMcp(request.headers.get("authorization"));
    if (request.method !== "POST") return Response.json({ error:"method_not_allowed" },{status:405,headers:{...headers,Allow:"POST, OPTIONS","Cache-Control":"no-store"}});
    rateLimit("mcp:tools:"+grant.userId,120,60*1000);
    const server = createProjectMcpServer(grant), transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse:true, maxRequestBodySize:2*1024*1024 });
    try { await server.connect(transport); const response = await transport.handleRequest(request); Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v)); response.headers.set("Cache-Control","no-store"); return response; }
    finally { await server.close(); }
  } catch (error) {
    const e=error instanceof OAuthError?error:new OAuthError("server_error","MCP服务暂不可用。",500);
    return Response.json({error:e.error,error_description:e.message},{status:e.status,headers:{...headers,"Cache-Control":"no-store",...(e.status===401?{"WWW-Authenticate":`Bearer resource_metadata="${publicOrigin()}/.well-known/oauth-protected-resource", scope="files:read files:write"`}:{})}});
  }
}
export const POST=handle, GET=handle;
export function OPTIONS(request: Request) { try { return new Response(null,{status:204,headers:cors(request)}); } catch { return new Response(null,{status:403}); } }
