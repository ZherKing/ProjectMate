import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

test("MCP OAuth：PKCE、项目授权、令牌轮换、撤销和成员失效",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"projectmate-mcp-test-")),previous={db:process.env.DATABASE_URL,url:process.env.AUTH_URL};process.env.DATABASE_URL=`file:${join(directory,"test.sqlite")}`;process.env.AUTH_URL="http://localhost:3000";
 const {sqlite}=await import("../src/lib/db/client");
 try{
 const oauth=await import("../src/lib/mcp/oauth"),{initializeDatabase}=await import("../src/lib/db/initialize"),{createRecruitmentProject}=await import("../src/lib/db/projects");initializeDatabase();
 for(const id of ["owner","member","outside"])sqlite.prepare("INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)").run(id,`${id}@test.invalid`,id,"unused",Date.now());
 const projectId=createRecruitmentProject({creatorId:"owner",competitionId:"",trackName:"",title:"MCP验证",description:"",roles:"",weeklyHours:10});sqlite.prepare("INSERT INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(projectId,"member","成员",Date.now());
 assert.throws(()=>oauth.registerMcpClient({redirect_uris:["javascript:alert(1)"]}),oauth.OAuthError);
 const client=oauth.registerMcpClient({client_name:"测试客户端",redirect_uris:["http://127.0.0.1:4444/callback"]}),verifier="a".repeat(64),challenge=createHash("sha256").update(verifier).digest("base64url");
 const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:"code",code_challenge:challenge,code_challenge_method:"S256",state:"opaque-state",resource:oauth.resourceUrl(),scope:"files:read files:write"});
 assert.throws(()=>oauth.validateAuthorization(new URLSearchParams({...Object.fromEntries(query),redirect_uri:"https://evil.invalid/callback"})),oauth.OAuthError);
 assert.throws(()=>oauth.validateAuthorization(new URLSearchParams({...Object.fromEntries(query),resource:"https://other.invalid/mcp"})),oauth.OAuthError);
 assert.throws(()=>oauth.validateAuthorization(new URLSearchParams({...Object.fromEntries(query),code_challenge_method:"plain"})),oauth.OAuthError);
 const request=oauth.validateAuthorization(query),nonce=oauth.createConsent("member",request);
 assert.throws(()=>oauth.completeConsent("outside",nonce,projectId,true,true),oauth.OAuthError);
 const location=new URL(oauth.completeConsent("member",nonce,projectId,true,true));assert.equal(location.searchParams.get("state"),"opaque-state");
 assert.throws(()=>oauth.completeConsent("member",nonce,projectId,true,true),oauth.OAuthError);
 const form=new URLSearchParams({grant_type:"authorization_code",code:location.searchParams.get("code")!,client_id:client.client_id,redirect_uri:client.redirect_uris[0],code_verifier:verifier,resource:oauth.resourceUrl()});
 assert.throws(()=>oauth.exchangeMcpToken(new URLSearchParams({...Object.fromEntries(form),code_verifier:"b".repeat(64)})),oauth.OAuthError);
 const tokens=oauth.exchangeMcpToken(form),grant=oauth.authenticateMcp("Bearer "+tokens.access_token);assert.equal(grant.projectId,projectId);assert.equal(grant.scope,"files:read files:write");
 assert.throws(()=>oauth.exchangeMcpToken(form),oauth.OAuthError);
 const refresh=new URLSearchParams({grant_type:"refresh_token",client_id:client.client_id,refresh_token:tokens.refresh_token,resource:oauth.resourceUrl()});const rotated=oauth.exchangeMcpToken(refresh);assert.throws(()=>oauth.exchangeMcpToken(refresh),oauth.OAuthError);assert.equal(oauth.authenticateMcp("Bearer "+rotated.access_token).userId,"member");
 assert.equal(oauth.listMcpGrants("owner",projectId).length,0);assert.equal(oauth.listMcpGrants("member",projectId).length,1);
 oauth.revokeMcpGrant("owner",grant.id);assert.ok(oauth.authenticateMcp("Bearer "+rotated.access_token));
 oauth.revokeMcpToken(rotated.access_token,client.client_id);assert.throws(()=>oauth.authenticateMcp("Bearer "+tokens.access_token),oauth.OAuthError);
 const readRequest=oauth.validateAuthorization(new URLSearchParams({...Object.fromEntries(query),scope:"files:read"}));const readNonce=oauth.createConsent("member",readRequest);assert.throws(()=>oauth.completeConsent("member",readNonce,projectId,true,true),oauth.OAuthError);
 const readCode=new URL(oauth.completeConsent("member",readNonce,projectId,false,true)).searchParams.get("code")!;const readTokens=oauth.exchangeMcpToken(new URLSearchParams({...Object.fromEntries(form),code:readCode}));assert.equal(oauth.authenticateMcp("Bearer "+readTokens.access_token).scope,"files:read");
 const {changeProjectMember}=await import("../src/lib/db/project-members");assert.equal(changeProjectMember({projectId,actorId:"owner",memberId:"member",operation:"remove"}).ok,true);assert.throws(()=>oauth.authenticateMcp("Bearer "+readTokens.access_token),oauth.OAuthError);
 sqlite.prepare("INSERT INTO project_members(project_id,user_id,role,joined_at) VALUES(?,?,?,?)").run(projectId,"member","成员",Date.now());assert.throws(()=>oauth.authenticateMcp("Bearer "+readTokens.access_token),oauth.OAuthError);
 const noState=new URLSearchParams(query);noState.delete("state");const noStateRequest=oauth.validateAuthorization(noState);const noStateNonce=oauth.createConsent("owner",noStateRequest);assert.equal(new URL(oauth.completeConsent("owner",noStateNonce,"",false,false)).searchParams.has("state"),false);
 const deniedNonce=oauth.createConsent("owner",request),denied=new URL(oauth.completeConsent("owner",deniedNonce,"",false,false));assert.equal(denied.searchParams.get("error"),"access_denied");assert.equal(denied.searchParams.get("code"),null);
 const stored=sqlite.prepare("SELECT token_hash AS hash FROM mcp_tokens LIMIT 1").get() as {hash:string}|undefined;if(stored)assert.equal(stored.hash.length,64);
 }finally{sqlite.close();if(previous.db===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous.db;if(previous.url===undefined)delete process.env.AUTH_URL;else process.env.AUTH_URL=previous.url;rmSync(directory,{recursive:true,force:true});}
});
