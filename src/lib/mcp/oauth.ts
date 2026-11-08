import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { sqlite } from "@/lib/db/client";
import { initializeDatabase } from "@/lib/db/initialize";
import { FileError } from "@/lib/files/store";
import { getProjectAccess } from "@/lib/db/project-members";

export class OAuthError extends Error { constructor(public error: string, message: string, public status = 400) { super(message); } }
export function publicOrigin() { return new URL(process.env.AUTH_URL || "http://localhost:3000").origin; }
export function resourceUrl() { return publicOrigin() + "/api/mcp"; }
export function tokenHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function secret() { return "pm_mcp_" + randomBytes(32).toString("base64url"); }
export function initMcp() {
  initializeDatabase();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mcp_clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, redirect_uris TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mcp_consents (nonce_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, request TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mcp_grants (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,project_id TEXT NOT NULL,client_id TEXT NOT NULL,scope TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER);
    CREATE TABLE IF NOT EXISTS mcp_codes (code_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL,redirect_uri TEXT NOT NULL,challenge TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mcp_tokens (token_hash TEXT PRIMARY KEY,grant_id TEXT NOT NULL,type TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS mcp_grants_user_idx ON mcp_grants(user_id,project_id);
    CREATE INDEX IF NOT EXISTS mcp_tokens_grant_idx ON mcp_tokens(grant_id);
    CREATE TABLE IF NOT EXISTS mcp_rate (key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
  `);
}
export function rateLimit(key: string, maximum: number, interval: number) {
  initMcp();
  const now = Date.now();
  sqlite.prepare("DELETE FROM mcp_rate WHERE reset_at<?").run(now);
  sqlite.prepare("INSERT INTO mcp_rate(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(key, now + interval);
  const row = sqlite.prepare("SELECT count FROM mcp_rate WHERE key=?").get(key) as { count: number };
  if (row.count > maximum) throw new OAuthError("temporarily_unavailable", "请求较频繁，请稍后重试。", 429);
}
function validateRedirect(uri: string) {
  let url: URL; try { url = new URL(uri); } catch { throw new OAuthError("invalid_client_metadata", "回调地址无效。"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.hash || url.username || url.password || uri.length > 2000) throw new OAuthError("invalid_client_metadata", "回调地址必须使用 HTTPS 或本机回环地址。");
}
export function registerMcpClient(body: Record<string, unknown>) {
  initMcp(); rateLimit("oauth:register", 100, 60 * 60 * 1000);
  if (!body || typeof body!=="object" || !Array.isArray(body.redirect_uris) || !body.redirect_uris.length || body.redirect_uris.length > 5 || body.redirect_uris.some(uri => typeof uri !== "string")) throw new OAuthError("invalid_client_metadata", "请提供有效的回调地址。");
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") throw new OAuthError("invalid_client_metadata", "本站客户端使用公共客户端与 PKCE，无需客户端密钥。");
  const uris = body.redirect_uris as string[]; uris.forEach(validateRedirect);
  const id = randomUUID(), name = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 80) || "MCP 客户端" : "MCP 客户端";
  sqlite.prepare("INSERT INTO mcp_clients(id,name,redirect_uris,created_at) VALUES(?,?,?,?)").run(id, name, JSON.stringify(uris), Date.now());
  return { client_id: id, client_name: name, client_id_issued_at: Math.floor(Date.now()/1000), redirect_uris: uris, token_endpoint_auth_method: "none", grant_types: ["authorization_code","refresh_token"], response_types: ["code"] };
}
export type ConsentRequest = { clientId: string; clientName: string; redirectUri: string; challenge: string; scope: string; state: string; resource: string };
export function validateAuthorization(query: URLSearchParams): ConsentRequest {
  initMcp();
  const clientId = query.get("client_id") || "", redirectUri = query.get("redirect_uri") || "";
  const client = sqlite.prepare("SELECT name,redirect_uris AS uris FROM mcp_clients WHERE id=?").get(clientId) as { name: string; uris: string } | undefined;
  if (!client || !(JSON.parse(client.uris) as string[]).includes(redirectUri)) throw new OAuthError("invalid_request", "客户端或回调地址无效。");
  if (query.get("response_type") !== "code") throw new OAuthError("unsupported_response_type", "仅支持授权码流程。");
  const challenge = query.get("code_challenge") || "";
  if (query.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw new OAuthError("invalid_request", "必须使用 PKCE S256。");
  const scopes = (query.get("scope") || "files:read").split(/\s+/).filter(Boolean);
  if (!scopes.length || scopes.some(scope => !["files:read", "files:write"].includes(scope))) throw new OAuthError("invalid_scope", "请求的权限无效。");
  const resource = query.get("resource") || "";
  if (resource !== resourceUrl()) throw new OAuthError("invalid_target", "授权目标与本站 MCP 地址不一致。");
  const state = query.get("state") || "";
  if (state.length > 2000) throw new OAuthError("invalid_request", "state 参数过长。");
  return { clientId, clientName: client.name, redirectUri, challenge, scope: scopes.includes("files:write") ? "files:read files:write" : "files:read", state, resource };
}
export function createConsent(userId: string, request: ConsentRequest) {
  initMcp(); rateLimit("oauth:consent:" + userId, 30, 5 * 60 * 1000);
  const nonce = secret();
  sqlite.prepare("DELETE FROM mcp_consents WHERE expires_at<?").run(Date.now());
  sqlite.prepare("INSERT INTO mcp_consents(nonce_hash,user_id,request,expires_at) VALUES(?,?,?,?)").run(tokenHash(nonce), userId, JSON.stringify(request), Date.now() + 10*60*1000);
  return nonce;
}
export function completeConsent(userId: string, nonce: string, projectId: string, write: boolean, allow: boolean) {
  initMcp();
  return sqlite.transaction(() => {
    const row = sqlite.prepare("SELECT request FROM mcp_consents WHERE nonce_hash=? AND user_id=? AND expires_at>?").get(tokenHash(nonce), userId, Date.now()) as { request: string } | undefined;
    if (!row) throw new OAuthError("invalid_request", "授权页面已过期，请从客户端重新发起连接。");
    const request = JSON.parse(row.request) as ConsentRequest;
    const redirect = new URL(request.redirectUri); if(request.state)redirect.searchParams.set("state", request.state);
    if (!allow) { sqlite.prepare("DELETE FROM mcp_consents WHERE nonce_hash=?").run(tokenHash(nonce)); redirect.searchParams.set("error", "access_denied"); return redirect.href; }
    if (!getProjectAccess(projectId, userId)) throw new OAuthError("access_denied", "没有所选项目的权限。", 403);
    if (write && !request.scope.includes("files:write")) throw new OAuthError("invalid_scope", "客户端未请求上传权限。");
    const id = randomUUID(), code = secret(), scope = write ? "files:read files:write" : "files:read";
    sqlite.prepare("INSERT INTO mcp_grants(id,user_id,project_id,client_id,scope,created_at,expires_at) VALUES(?,?,?,?,?,?,?)").run(id, userId, projectId, request.clientId, scope, Date.now(), Date.now()+30*24*60*60*1000);
    sqlite.prepare("INSERT INTO mcp_codes(code_hash,grant_id,redirect_uri,challenge,expires_at) VALUES(?,?,?,?,?)").run(tokenHash(code), id, request.redirectUri, request.challenge, Date.now()+2*60*1000);
    sqlite.prepare("DELETE FROM mcp_consents WHERE nonce_hash=?").run(tokenHash(nonce));
    redirect.searchParams.set("code", code); redirect.searchParams.set("iss", publicOrigin());
    return redirect.href;
  })();
}
export type McpGrant = { id: string; userId: string; projectId: string; clientId: string; scope: string; expiresAt: number };
function grantById(id: string) {
  const grant = sqlite.prepare("SELECT g.id,g.user_id AS userId,g.project_id AS projectId,g.client_id AS clientId,g.scope,g.expires_at AS expiresAt FROM mcp_grants g JOIN users u ON u.id=g.user_id WHERE g.id=? AND g.revoked_at IS NULL AND g.expires_at>?").get(id, Date.now()) as McpGrant | undefined;
  if (!grant || !getProjectAccess(grant.projectId, grant.userId)) throw new OAuthError("invalid_grant", "项目授权已失效，请重新连接。", 401);
  return grant;
}
function issueTokens(grant: McpGrant) {
  const access = secret(), refresh = secret();
  const expiresAt = Math.min(grant.expiresAt, Date.now()+60*60*1000);
  const insert = sqlite.prepare("INSERT INTO mcp_tokens(token_hash,grant_id,type,expires_at) VALUES(?,?,?,?)");
  insert.run(tokenHash(access), grant.id, "access", expiresAt); insert.run(tokenHash(refresh), grant.id, "refresh", grant.expiresAt);
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: Math.max(1,Math.floor((expiresAt-Date.now())/1000)), scope: grant.scope };
}
export function exchangeMcpToken(form: URLSearchParams) {
  initMcp(); rateLimit("oauth:token", 500, 60*1000);
  return sqlite.transaction(() => {
    if (form.get("resource") !== resourceUrl()) throw new OAuthError("invalid_target", "令牌请求的 resource 不正确。");
    const clientId = form.get("client_id");
    if (!clientId) throw new OAuthError("invalid_client", "缺少 client_id。");
    if (form.get("grant_type") === "authorization_code") {
      const hash = tokenHash(form.get("code") || "");
      const code = sqlite.prepare("SELECT grant_id AS grantId,redirect_uri AS redirectUri,challenge FROM mcp_codes WHERE code_hash=? AND expires_at>?").get(hash, Date.now()) as { grantId: string; redirectUri: string; challenge: string } | undefined;
      if (!code) throw new OAuthError("invalid_grant", "授权码已过期或已使用。");
      const grant = grantById(code.grantId), verifier = form.get("code_verifier") || "";
      if (grant.clientId !== clientId || form.get("redirect_uri") !== code.redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new OAuthError("invalid_grant", "授权码验证失败。");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      if (!timingSafeEqual(Buffer.from(challenge), Buffer.from(code.challenge))) throw new OAuthError("invalid_grant", "PKCE 验证失败。");
      sqlite.prepare("DELETE FROM mcp_codes WHERE code_hash=?").run(hash);
      return issueTokens(grant);
    }
    if (form.get("grant_type") === "refresh_token") {
      const hash = tokenHash(form.get("refresh_token") || "");
      const row = sqlite.prepare("SELECT grant_id AS grantId FROM mcp_tokens WHERE token_hash=? AND type='refresh' AND expires_at>?").get(hash, Date.now()) as { grantId: string } | undefined;
      if (!row) throw new OAuthError("invalid_grant", "刷新令牌已过期或已使用。");
      const grant = grantById(row.grantId);
      if (grant.clientId !== clientId) throw new OAuthError("invalid_grant", "客户端不匹配。");
      sqlite.prepare("DELETE FROM mcp_tokens WHERE token_hash=?").run(hash);
      return issueTokens(grant);
    }
    throw new OAuthError("unsupported_grant_type", "不支持此授权流程。");
  })();
}
export function authenticateMcp(authorization: string | null): McpGrant {
  initMcp();
  if (!authorization || !/^Bearer pm_mcp_[A-Za-z0-9_-]{43}$/.test(authorization)) throw new OAuthError("invalid_token", "需要 MCP 授权。", 401);
  const row = sqlite.prepare("SELECT grant_id AS grantId FROM mcp_tokens WHERE token_hash=? AND type='access' AND expires_at>?").get(tokenHash(authorization.slice(7)), Date.now()) as { grantId: string } | undefined;
  if (!row) throw new OAuthError("invalid_token", "访问令牌无效或已过期。", 401);
  return grantById(row.grantId);
}
export function listMcpGrants(userId: string, projectId: string) {
  initMcp(); if (!getProjectAccess(projectId, userId)) throw new OAuthError("access_denied", "没有项目权限。", 403);
  return sqlite.prepare("SELECT g.id,c.name AS clientName,g.scope,g.created_at AS createdAt,g.expires_at AS expiresAt FROM mcp_grants g JOIN mcp_clients c ON c.id=g.client_id WHERE g.user_id=? AND g.project_id=? AND g.revoked_at IS NULL AND g.expires_at>? ORDER BY g.created_at DESC").all(userId, projectId, Date.now());
}
export function revokeMcpGrant(userId: string, grantId: string) {
  initMcp();
  sqlite.transaction(() => { sqlite.prepare("UPDATE mcp_grants SET revoked_at=? WHERE id=? AND user_id=?").run(Date.now(), grantId, userId); sqlite.prepare("DELETE FROM mcp_tokens WHERE grant_id IN (SELECT id FROM mcp_grants WHERE id=? AND user_id=?)").run(grantId, userId); })();
}
export function revokeMcpToken(token: string, clientId: string) {
  initMcp();
  const row = sqlite.prepare("SELECT g.id,g.user_id AS userId FROM mcp_tokens t JOIN mcp_grants g ON g.id=t.grant_id WHERE t.token_hash=? AND g.client_id=?").get(tokenHash(token), clientId) as { id: string; userId: string } | undefined;
  if (row) revokeMcpGrant(row.userId, row.id);
}
export function oauthFailure(error: unknown) { const e = error instanceof OAuthError ? error : error instanceof FileError ? new OAuthError("invalid_request",error.message,error.status) : error instanceof SyntaxError ? new OAuthError("invalid_request","请求数据格式无效。") : new OAuthError("server_error", "授权服务暂不可用。", 500); return Response.json({ error: e.error, error_description: e.message }, { status: e.status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache", "Access-Control-Allow-Origin": "*" } }); }
