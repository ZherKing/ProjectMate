import { readBody } from "@/lib/files/http";
import { oauthFailure, revokeMcpToken } from "@/lib/mcp/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const form = new URLSearchParams((await readBody(request, 16384)).toString()); revokeMcpToken(form.get("token") || "", form.get("client_id") || ""); return new Response(null, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }); } catch (error) { return oauthFailure(error); } }
export { OPTIONS } from "../register/route";
