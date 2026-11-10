import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("GeeTest fails closed and issues purpose/subject-bound one-use persistent tickets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "projectmate-geetest-"));
  process.env.DATABASE_URL = "file:" + join(dir, "test.sqlite");
  const originalFetch = globalThis.fetch;
  const names = ["GEETEST_ENABLED", "GEETEST_ID", "GEETEST_KEY", "AUTH_URL"] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const { sqlite } = await import("../src/lib/db/client");
  try {
    const { captchaConfig, consumeCaptcha, verifyCaptcha } = await import("../src/lib/security/geetest");
    const route = await import("../src/app/api/auth/captcha/route");
    process.env.GEETEST_ENABLED = "false";
    delete process.env.GEETEST_ID; delete process.env.GEETEST_KEY;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("must not be called"); };
    assert.deepEqual(captchaConfig(), { enabled: false });
    consumeCaptcha(undefined, "login", "");
    assert.deepEqual(await verifyCaptcha({} as never), { ok: true, enabled: false });
    assert.equal(calls, 0);
    process.env.GEETEST_ENABLED = "true";
    assert.throws(() => captchaConfig(), (e:unknown) => (e as {status:number}).status === 503);
    assert.equal((await route.GET()).status,503);
    process.env.GEETEST_ID = "1".repeat(32); process.env.GEETEST_KEY = "server-only-secret";
    const publicConfig = await (await route.GET()).json();
    assert.deepEqual(publicConfig,{enabled:true,captchaId:"1".repeat(32)});
    assert.ok(!JSON.stringify(publicConfig).includes("server-only-secret"));
    const proof = (extra={}) => ({purpose:"login" as const,subject:" User@Test.invalid ",lot_number:randomBytes(16).toString("hex"),captcha_output:"output",pass_token:"pass",gen_time:String(Math.floor(Date.now()/1000)),...extra});
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(String(url),"https://gcaptcha4.geetest.com/validate?captcha_id="+"1".repeat(32));
      assert.equal(init?.method,"POST"); assert.equal(init?.redirect,"error"); assert.ok(init?.signal);
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get("sign_token"),createHmac("sha256","server-only-secret").update(form.get("lot_number")!).digest("hex"));
      assert.equal(form.get("captcha_output"),"output");
      return Response.json({result:"success",captcha_args:{lot_number:form.get("lot_number")}});
    };
    const first = proof();
    const result = await verifyCaptcha(first,"test-client");
    assert.equal(result.enabled,true); assert.ok("ticket" in result); assert.equal(result.expiresIn,300);
    const token = result.ticket;
    assert.throws(() => consumeCaptcha(token,"register","user@test.invalid"));
    assert.throws(() => consumeCaptcha(token,"login","other@test.invalid"));
    consumeCaptcha(token,"login","USER@test.invalid");
    assert.throws(() => consumeCaptcha(token,"login","user@test.invalid"));
    await assert.rejects(verifyCaptcha(first,"test-client"), (e:unknown) => (e as {code:string}).code === "captcha_replayed");
    const next = await verifyCaptcha(proof(),"test-client");
    assert.ok("ticket" in next);
    sqlite.prepare("UPDATE captcha_tickets SET expires_at=?").run(Date.now()-1);
    assert.throws(() => consumeCaptcha(next.ticket,"login","user@test.invalid"));
    const parallel = proof();
    const attempts = await Promise.allSettled([verifyCaptcha(parallel,"test-client"),verifyCaptcha(parallel,"test-client")]);
    assert.equal(attempts.filter(a=>a.status==="fulfilled").length,1);
    for(const mode of ["failure","network","http","invalid-json","wrong-lot"]) {
      globalThis.fetch = async () => {
        if(mode==="network")throw new Error("network unavailable");
        if(mode==="http")return new Response("failure",{status:500});
        if(mode==="invalid-json")return new Response("not-json");
        if(mode==="wrong-lot")return Response.json({result:"success",captcha_args:{lot_number:"wrong"}});
        return Response.json({result:"fail"});
      };
      await assert.rejects(verifyCaptcha(proof(),"test-client"));
    }
    globalThis.fetch = async()=>Response.json({result:"success"});
    const post = (body:unknown,origin="http://test.invalid") => route.POST(new Request("http://test.invalid/api/auth/captcha",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)}));
    assert.equal((await post(proof(),"https://other.invalid")).status,403);
    assert.equal((await post({})).status,400);
    const response = await post(proof({purpose:"github",subject:"github"}));
    assert.equal(response.status,200);
    const posted = await response.json(); consumeCaptcha(posted.ticket,"github","github");
    assert.ok(!JSON.stringify(sqlite.prepare("SELECT * FROM captcha_tickets").all()).includes("server-only-secret"));
    assert.ok(!JSON.stringify(sqlite.prepare("SELECT * FROM captcha_tickets").all()).includes("user@test.invalid"));
    sqlite.prepare("INSERT OR REPLACE INTO security_limits(key,count,expires_at) VALUES(?,?,?)").run("captcha:remote:" + (await import("node:crypto")).createHash("sha256").update("limited").digest("hex"),300,Date.now()+60000);
    await assert.rejects(verifyCaptcha(proof(),"limited"), (e:unknown) => (e as {status:number}).status === 429);
  } finally {
    globalThis.fetch = originalFetch;
    for(const name of names) {if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}
    sqlite.close(); rmSync(dir,{recursive:true,force:true});
  }
});
