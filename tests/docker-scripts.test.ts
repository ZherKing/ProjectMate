import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";

test("Docker offline archives: pinned version/platform, load before up, failure preserves service", () => {
 const dir=mkdtempSync(join(tmpdir(),"pm-docker-offline-"));
 try {
  const log=join(dir,'calls.log'),envFile=join(dir,'server config.env'),out=join(dir,'export dir');
  writeFileSync(envFile,'AUTH_SECRET=test-only\n');
  writeFileSync(join(dir,'docker'),`#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2);fs.appendFileSync(process.env.DOCKER_TEST_LOG,JSON.stringify({args:a,image:process.env.PROJECTMATE_IMAGE})+'\\n');
if(process.env.DOCKER_TEST_FAIL&&a.includes(process.env.DOCKER_TEST_FAIL))process.exit(7);
if(a[0]==='image'&&a[1]==='save')process.stdout.write('fake-image-tar');
if(a[0]==='image'&&a[1]==='load')console.log('Loaded image: '+(process.env.DOCKER_TEST_LOADED||'projectmate:1.0.0'));
`,{mode:0o755});
  const env={...process.env,PATH:dir+':'+process.env.PATH,DOCKER_TEST_LOG:log,PROJECTMATE_ENV_FILE:envFile,PROJECTMATE_OUTPUT_DIR:out};
  const run=(script:string,args:string[],extra:Record<string,string>={})=>spawnSync('bash',[resolve(script),...args],{env:{...env,...extra},encoding:'utf8'});
  const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l) as {args:string[];image:string});
  for(const args of [[],['latest'],['LATEST']])assert.notEqual(run('build.sh',args).status,0);
  assert.equal(run('build.sh',['1.0.0']).status,0);
  const archive=join(out,'projectmate-1.0.0.tar.gz');assert.equal(gunzipSync(readFileSync(archive)).toString(),'fake-image-tar');
  assert.ok(calls().some(c=>c.args[0]==='build'&&c.args.includes('linux/amd64')));
  assert.notEqual(run('build.sh',['1.0.0']).status,0,'must not overwrite archive');
  assert.equal(run('build.sh',['1.0.1'],{PROJECTMATE_PLATFORM:'linux/arm64'}).status,0);
  assert.notEqual(run('build.sh',['1.0.2'],{PROJECTMATE_PLATFORM:'wrong'}).status,0);
  assert.notEqual(run('build.sh',['1.0.3'],{DOCKER_TEST_FAIL:'save'}).status,0);assert.equal(existsSync(join(out,'projectmate-1.0.3.tar.gz')),false);
  writeFileSync(log,'');assert.equal(run('deploy.sh',[archive,'projectmate:1.0.0']).status,0);
  let recorded=calls();const load=recorded.findIndex(c=>c.args.includes('load')),up=recorded.findIndex(c=>c.args.includes('up'));
  assert.ok(load>=0&&up>load);assert.equal(recorded[up].image,'projectmate:1.0.0');assert.ok(recorded[up].args.includes('--wait'));assert.ok(recorded[up].args.includes('never'));assert.ok(recorded.every(c=>!c.args.includes('down')&&!c.args.includes('pull')&&!c.args.includes('push')));
  for(const extra of [{DOCKER_TEST_FAIL:'load'},{DOCKER_TEST_LOADED:'other:1.0.0'},{PROJECTMATE_PORT:'70000'},{PROJECTMATE_ENV_FILE:join(dir,'missing')}]){writeFileSync(log,'');assert.notEqual(run('deploy.sh',[archive,'projectmate:1.0.0'],extra).status,0);assert.ok(!calls().some(c=>c.args.includes('up')));}
  const bad=join(dir,'corrupt.tar.gz');writeFileSync(bad,'not gzip');assert.notEqual(run('deploy.sh',[bad,'projectmate:1.0.0']).status,0);
  for(const args of [[archive,'projectmate:latest'],[archive,'projectmate'],['missing.tar.gz','projectmate:1.0.0']])assert.notEqual(run('deploy.sh',args).status,0);
  writeFileSync(log,'');assert.equal(run('deploy.sh',['projectmate:1.0.0','--local']).status,0);assert.ok(!calls().some(c=>c.args.includes('load')));
 } finally {rmSync(dir,{recursive:true,force:true});}
});
