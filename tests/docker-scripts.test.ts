import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("Docker scripts require pinned images and preserve deployment data without real Docker", () => {
  const dir = mkdtempSync(join(tmpdir(), "projectmate-docker-script-"));
  try {
    const log = join(dir, "calls.log"), envFile = join(dir, "server config.env");
    writeFileSync(envFile, "AUTH_SECRET=local-test-only\n");
    writeFileSync(join(dir, "docker"), `#!/usr/bin/env node
const fs=require('node:fs');fs.appendFileSync(process.env.DOCKER_TEST_LOG,JSON.stringify({args:process.argv.slice(2),image:process.env.PROJECTMATE_IMAGE,envFile:process.env.PROJECTMATE_ENV_FILE})+'\\n');
if(process.env.DOCKER_TEST_FAIL&&process.argv.includes(process.env.DOCKER_TEST_FAIL))process.exit(7);
`, { mode: 0o755 });
    const env = { ...process.env, PATH: dir + ":" + process.env.PATH, DOCKER_TEST_LOG: log, PROJECTMATE_ENV_FILE: envFile };
    const run = (script:string,args:string[],extra:Record<string,string>={}) => spawnSync("bash", [resolve(script), ...args], { env: {...env,...extra}, encoding:"utf8" });
    const calls = () => readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line) as {args:string[];image:string;envFile:string});
    for (const [script,args] of [["build.sh",[]],["build.sh",["latest"]],["build.sh",["LATEST"]],["deploy.sh",["projectmate"]],["deploy.sh",["projectmate:latest"]],["deploy.sh",["projectmate:1.0.0","--wrong"]]] as const) {
      assert.notEqual(run(script,[...args]).status,0);
    }
    assert.equal(run("build.sh",["1.0.0","localhost:5000/projectmate"]).status,0);
    const build = calls().find(call => call.args[0] === "build")!;
    assert.ok(build.args.includes("localhost:5000/projectmate:1.0.0"));
    assert.ok(!build.args.includes("push"));
    writeFileSync(log, "");
    assert.equal(run("deploy.sh",["ghcr.io/test/projectmate:1.0.0"]).status,0);
    let recorded = calls();
    const pull = recorded.findIndex(call => call.args.includes("pull"));
    const up = recorded.findIndex(call => call.args.includes("up"));
    assert.ok(pull >= 0 && up > pull);
    assert.ok(recorded[up].args.includes("--wait"));
    assert.ok(recorded[up].args.includes("--no-build"));
    assert.ok(recorded[up].args.includes("never"));
    assert.ok(recorded.every(call => !call.args.includes("down") && !call.args.includes("-v")));
    assert.equal(recorded[up].image,"ghcr.io/test/projectmate:1.0.0");
    assert.equal(recorded[up].envFile,envFile);
    assert.ok(recorded[up].args.includes("projectmate"));
    writeFileSync(log, "");
    assert.equal(run("deploy.sh",["projectmate:1.0.0","--local"]).status,0);
    recorded = calls();
    assert.ok(recorded.some(call => call.args[0] === "image" && call.args[1] === "inspect"));
    assert.ok(!recorded.some(call => call.args.includes("pull") && !call.args.includes("up")));
    writeFileSync(log, "");
    assert.notEqual(run("deploy.sh",["projectmate:1.0.0"],{DOCKER_TEST_FAIL:"pull"}).status,0);
    assert.ok(!calls().some(call => call.args.includes("up")),"pull failure must not stop or recreate the current service");
    assert.notEqual(run("deploy.sh",["projectmate:1.0.0"],{PROJECTMATE_PORT:"70000"}).status,0);
    assert.notEqual(run("deploy.sh",["projectmate:1.0.0"],{PROJECTMATE_ENV_FILE:join(dir,"missing")}).status,0);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
