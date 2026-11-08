import { currentUserId, fileFailure, readBody, requireSameOrigin } from "@/lib/files/http";
import { listMcpGrants, oauthFailure, revokeMcpGrant, OAuthError } from "@/lib/mcp/oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return Response.json({ grants: listMcpGrants(await currentUserId(), new URL(request.url).searchParams.get("project") || "") }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return error instanceof OAuthError ? oauthFailure(error) : fileFailure(error); } }
export async function DELETE(request: Request) { try { requireSameOrigin(request); const userId = await currentUserId(), body = JSON.parse((await readBody(request, 4096)).toString()); if (typeof body.id !== "string") throw new OAuthError("invalid_request", "授权标识无效。"); revokeMcpGrant(userId, body.id); return Response.json({ ok: true }); } catch (error) { return error instanceof OAuthError ? oauthFailure(error) : fileFailure(error); } }
