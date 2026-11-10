import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('deploy prompts for actual archive and selects only imported pinned tags',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pm-deploy-prompt-'));
 try{
  const archive=join(dir,'renamed image.tar'),envFile=join(dir,'server.env'),log=join(dir,'calls.log');
  writeFileSync(archive,'mock');writeFileSync(envFile,'AUTH_SECRET=test-secret\nAUTH_URL=https://test.invalid\n');writeFileSync(log,'');
  writeFileSync(join(dir,'docker'),`#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2);fs.appendFileSync(process.env.CALL_LOG,JSON.stringify({args:a,image:process.env.PROJECTMATE_IMAGE})+'\\n');if(a[0]==='image'&&a[1]==='load'){if(process.env.FAIL_LOAD)process.exit(7);console.log(process.env.LOAD_RESULT||'Loaded image: projectmate:1.2.3');}
`,{mode:0o755});
  const run=(input:string,extra:Record<string,string>={},args:string[]=[])=>spawnSync('bash',[resolve('deploy.sh'),...args],{cwd:dir,input,encoding:'utf8',env:{...process.env,PATH:dir+':'+process.env.PATH,PROJECTMATE_ENV_FILE:envFile,CALL_LOG:log,...extra}});
  const calls=()=>readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l) as {args:string[];image:string});
  const result=run(archive+'\n');assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/请输入镜像包文件名/);assert.ok(calls().some(c=>c.args.includes('up')&&c.image==='projectmate:1.2.3'));
  for(const [input,extra] of [['\n',{}],['missing.tar\n',{}],[archive+'\n',{FAIL_LOAD:'1'}],[archive+'\n',{LOAD_RESULT:'Loaded image ID: sha256:fake'}],[archive+'\n',{LOAD_RESULT:'Loaded image: projectmate:latest'}]] as Array<[string,Record<string,string>]>) {writeFileSync(log,'');assert.notEqual(run(input,extra).status,0);assert.ok(!calls().some(c=>c.args.includes('up')));}
  const multi={LOAD_RESULT:'Loaded image: projectmate:1.2.3\nLoaded image: projectmate:2.0.0'};
  writeFileSync(log,'');assert.equal(run(archive+'\nprojectmate:2.0.0\n',multi).status,0);assert.ok(calls().some(c=>c.args.includes('up')&&c.image==='projectmate:2.0.0'));
  writeFileSync(log,'');assert.notEqual(run(archive+'\nother:1.0.0\n',multi).status,0);assert.ok(!calls().some(c=>c.args.includes('up')));
  writeFileSync(log,'');assert.equal(run('',{},[archive,'projectmate:1.2.3']).status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
