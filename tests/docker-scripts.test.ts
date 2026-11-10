import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";

test("Docker release ZIP: clean bundle, automatic deployment, config retention and failure handling", () => {
  const dir = mkdtempSync(join(tmpdir(), "pm-docker-offline-"));
  try {
    const log = join(dir, "calls.log"), envFile = join(dir, "server config.env"), out = join(dir, "export dir");
    writeFileSync(log, "");
    writeFileSync(envFile, "AUTH_SECRET=test-only\nAUTH_URL=https://example.com\n");
    writeFileSync(join(dir, "docker"), `#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_TEST_LOG,JSON.stringify({args:a,image:process.env.PROJECTMATE_IMAGE})+'\\n');
if(process.env.DOCKER_TEST_FAIL&&a.includes(process.env.DOCKER_TEST_FAIL))process.exit(7);
if(a[0]==='image'&&a[1]==='save')fs.writeFileSync(a[a.indexOf('--output')+1],'fake-image-tar');
if(a[0]==='image'&&a[1]==='load'&&process.env.DOCKER_TEST_NO_TAG) { console.log('Loaded image ID: sha256:fake'); process.exit(0); }
if(a[0]==='image'&&a[1]==='load')console.log('Loaded image: '+(process.env.DOCKER_TEST_LOADED||'projectmate:1.0.0'));
`, { mode: 0o755 });
    const env = { ...process.env, PATH: dir + ':' + process.env.PATH, DOCKER_TEST_LOG: log, PROJECTMATE_ENV_FILE: envFile, PROJECTMATE_OUTPUT_DIR: out };
    const run = (script: string, args: string[], extra: Record<string, string | undefined> = {}, input?: string) =>
      spawnSync('bash', [resolve(script), ...args], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8', input });
    const calls = () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l) as { args: string[]; image: string });
    const success = (r: ReturnType<typeof run>) => assert.equal(r.status, 0, r.stderr + r.stdout);
    for (const args of [[], ['latest'], ['LATEST']]) assert.notEqual(run('build.sh', args).status, 0);
    success(run('build.sh', ['1.0.0']));
    const zip = join(out, 'projectmate-1.0.0-amd64.zip');
    const listing = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' });
    assert.equal(listing.status, 0);
    assert.deepEqual(listing.stdout.trim().split('\n').sort(), [
      '.env.example', 'DEPLOYMENT.md', 'deploy.sh', 'docker-compose.deploy.yml',
      'projectmate-1.0.0-amd64.tar', 'release.txt',
    ].sort());
    const release = join(dir, 'release dir');
    mkdirSync(release);
    assert.equal(spawnSync('unzip', ['-q', zip, '-d', release]).status, 0);
    assert.equal(readFileSync(join(release, 'projectmate-1.0.0-amd64.tar'), 'utf8'), 'fake-image-tar');
    assert.equal(readFileSync(join(release, 'release.txt'), 'utf8'), 'projectmate:1.0.0\nprojectmate-1.0.0-amd64.tar\n');
    assert.ok(calls().some(c => c.args[0] === 'build' && c.args.includes('linux/amd64')));
    assert.notEqual(run('build.sh', ['1.0.0']).status, 0, 'must not overwrite ZIP');
    success(run('build.sh', ['1.0.1'], { PROJECTMATE_PLATFORM: 'linux/arm64' }));
    assert.ok(existsSync(join(out, 'projectmate-1.0.1-arm64.zip')));
    assert.notEqual(run('build.sh', ['1.0.2'], { PROJECTMATE_PLATFORM: 'wrong' }).status, 0);
    assert.notEqual(run('build.sh', ['1.0.3'], { DOCKER_TEST_FAIL: 'save' }).status, 0);
    assert.equal(existsSync(join(out, 'projectmate-1.0.3-amd64.zip')), false);

    writeFileSync(log, '');
    success(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0']));
    let recorded = calls();
    const load = recorded.findIndex(c => c.args.includes('load')), up = recorded.findIndex(c => c.args.includes('up'));
    assert.ok(load >= 0 && up > load);
    assert.equal(recorded[up].image, 'projectmate:1.0.0');
    for (const flag of ['--wait', '--no-build', 'never']) assert.ok(recorded[up].args.includes(flag));
    assert.ok(recorded[up].args.includes('projectmate'));
    assert.ok(recorded.every(c => !c.args.includes('down') && !c.args.includes('pull') && !c.args.includes('push')));
    assert.equal(readFileSync(envFile, 'utf8'), 'AUTH_SECRET=test-only\nAUTH_URL=https://example.com\n');
    for (const extra of [
      { DOCKER_TEST_FAIL: 'load' }, { DOCKER_TEST_LOADED: 'other:1.0.0' },
      { PROJECTMATE_PORT: '70000' }, { PROJECTMATE_ENV_FILE: join(dir, 'missing') },
      { DOCKER_TEST_FAIL: 'config' },
    ]) {
      writeFileSync(log, '');
      assert.notEqual(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], extra).status, 0);
      assert.ok(!calls().some(c => c.args.includes('up')));
    }
    writeFileSync(log, '');
    assert.notEqual(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], { DOCKER_TEST_FAIL: 'up' }).status, 0);
    assert.ok(calls().some(c => c.args.includes('logs')));
    assert.ok(calls().every(c => !c.args.includes('down')));

    // Non-interactive first install creates a private config, but waits for the operator's URL.
    writeFileSync(log, '');
    assert.notEqual(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], { PROJECTMATE_ENV_FILE: undefined }).status, 0);
    const localEnv = join(release, '.env');
    const initial = readFileSync(localEnv, 'utf8');
    assert.match(initial, /^AUTH_SECRET=[a-f0-9]{64}$/m);
    assert.equal(statSync(localEnv).mode & 0o777, 0o600);
    assert.ok(!calls().some(c => c.args.includes('load') || c.args.includes('up')));
    writeFileSync(localEnv, initial.replace('AUTH_URL=http://localhost:3000', 'AUTH_URL=https://site.example'));
    success(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], { PROJECTMATE_ENV_FILE: undefined }));
    const configured = readFileSync(localEnv, 'utf8');
    success(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], { PROJECTMATE_ENV_FILE: undefined }));
    assert.equal(readFileSync(localEnv, 'utf8'), configured, 'upgrade must preserve the config and secret');
    // Extraction of a new release does not overwrite server config.
    assert.equal(spawnSync('unzip', ['-oq', zip, '-d', release]).status, 0);
    assert.equal(readFileSync(localEnv, 'utf8'), configured);

    writeFileSync(localEnv, 'AUTH_SECRET="change-me"\nAUTH_URL=https://site.example\n');
    assert.notEqual(run(join(release, 'deploy.sh'), [join(release, 'projectmate-1.0.0-amd64.tar'), 'projectmate:1.0.0'], { PROJECTMATE_ENV_FILE: undefined }).status, 0);
    // No-argument mode always asks; stale metadata must never override the operator's filename.
    writeFileSync(join(release, 'release.txt'), 'projectmate:wrong\nmissing.tar\n');
    writeFileSync(log, '');
    success(run('deploy.sh', [], {}, join(release, 'projectmate-1.0.0-amd64.tar')+'\n'));
    assert.ok(calls().some(c => c.args.includes('up') && c.image === 'projectmate:1.0.0'));
    writeFileSync(log, '');
    assert.notEqual(run('deploy.sh', [], {}, 'missing-file.tar\n').status, 0);
    assert.ok(!calls().some(c => c.args.includes('load') || c.args.includes('up')));
    assert.notEqual(run('deploy.sh', [], {}, '\n').status, 0);
    assert.notEqual(run('deploy.sh', [], {}, '').status, 0);
    writeFileSync(log, '');
    assert.notEqual(run('deploy.sh', [], {DOCKER_TEST_LOADED:'projectmate:latest'}, join(release, 'projectmate-1.0.0-amd64.tar')+'\n').status, 0);
    assert.ok(!calls().some(c => c.args.includes('up')));
    writeFileSync(log, '');
    assert.notEqual(run('deploy.sh', [], {DOCKER_TEST_NO_TAG:'1'}, join(release, 'projectmate-1.0.0-amd64.tar')+'\n').status, 0);
    assert.ok(!calls().some(c => c.args.includes('up')));
    // Multiple tags require an explicit selection from the imported tags.
    writeFileSync(log, '');
    const multiple='projectmate:1.0.0\nLoaded image: projectmate:2.0.0';
    success(run('deploy.sh', [], {DOCKER_TEST_LOADED:multiple}, join(release, 'projectmate-1.0.0-amd64.tar')+'\nprojectmate:2.0.0\n'));
    assert.ok(calls().some(c => c.args.includes('up') && c.image === 'projectmate:2.0.0'));
    writeFileSync(log, '');
    assert.notEqual(run('deploy.sh', [], {DOCKER_TEST_LOADED:multiple}, join(release, 'projectmate-1.0.0-amd64.tar')+'\nother:3.0.0\n').status, 0);
    assert.ok(!calls().some(c => c.args.includes('up')));

    // Legacy archive and local-image modes remain available.
    const oldArchive = join(dir, 'legacy.tar.gz');
    writeFileSync(oldArchive, gzipSync('fake-image-tar'));
    success(run('deploy.sh', [oldArchive, 'projectmate:1.0.0']));
    const bad = join(dir, 'corrupt.tar.gz');
    writeFileSync(bad, 'not gzip');
    assert.notEqual(run('deploy.sh', [bad, 'projectmate:1.0.0']).status, 0);
    for (const args of [[oldArchive, 'projectmate:latest'], [oldArchive, 'projectmate'], ['missing.tar', 'projectmate:1.0.0']])
      assert.notEqual(run('deploy.sh', args).status, 0);
    writeFileSync(log, '');
    success(run('deploy.sh', ['projectmate:1.0.0', '--local']));
    assert.ok(!calls().some(c => c.args.includes('load')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
