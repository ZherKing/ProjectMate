import { readBody } from "@/lib/files/http";
import { oauthFailure, registerMcpClient } from "@/lib/mcp/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const body = JSON.parse((await readBody(request, 16384)).toString()); return Response.json(registerMcpClient(body), { status: 201, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }); } catch (error) { return oauthFailure(error); } }
export function OPTIONS() { return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }); }
