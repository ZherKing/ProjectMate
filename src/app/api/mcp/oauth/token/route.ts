import { readBody } from "@/lib/files/http";
import { exchangeMcpToken, oauthFailure } from "@/lib/mcp/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) { try { return Response.json(exchangeMcpToken(new URLSearchParams((await readBody(request, 16384)).toString())), { headers: { "Cache-Control": "no-store", "Pragma": "no-cache", "Access-Control-Allow-Origin": "*" } }); } catch (error) { return oauthFailure(error); } }
export { OPTIONS } from "../register/route";
