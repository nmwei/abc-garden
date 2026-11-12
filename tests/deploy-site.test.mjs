import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareSite, inventory, digest} from '../scripts/deploy-site.mjs';

test('deployment freezes a complete snapshot, excludes hidden files and detects tampering', async () => {
  const root = await mkdtemp(join(tmpdir(), 'garden-deploy-test-'));
  try {
    await mkdir(join(root, 'dist/app/account-runtime'), {recursive: true});
    await writeFile(join(root,'dist/app/account-runtime/runtime.json'),JSON.stringify({version:'0.1.0',fingerprint:'test',source:{repository:'garden-platform',commit:'b'.repeat(40),dirty:false}}));
    await writeFile(join(root, 'package.json'), JSON.stringify({name: 'abc-garden'}));
    for (const file of ['index.html', 'app/main.js', 'manifest.webmanifest', 'sw.js']) await writeFile(join(root, 'dist', file), file);
    await writeFile(join(root, 'dist/.env'), 'must not be published');
    const output = join(root, 'snapshot');
    const result = await prepareSite(root, output, 'a'.repeat(40), true);
    assert.match(result.release, /^\d{8}T\d{9}Z-[a-f0-9]{8}$/);
    assert.equal(result.fileCount, 6);
    await assert.rejects(readFile(join(output, '.env')));
    const manifest = await readFile(join(output, '.deploy-manifest.json'));
    assert.equal(digest(manifest), result.manifestSha256);
    assert.deepEqual((await inventory(output)), JSON.parse(manifest).files);
    await writeFile(join(root, 'dist/index.html'), 'changed after snapshot');
    assert.equal(await readFile(join(output, 'index.html'), 'utf8'), 'index.html');
    await symlink('/tmp', join(root, 'dist/unsafe'));
    await assert.rejects(inventory(join(root, 'dist')), /symlink/);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('default deploy refuses a dirty tree without touching its index or contacting SSH', async () => {
  const root = await mkdtemp(join(tmpdir(), 'garden-deploy-guard-'));
  try {
    execFileSync('git', ['init', '--quiet', '--initial-branch=main', root]);
    await writeFile(join(root, 'pending.txt'), 'review me');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/publish.mjs', import.meta.url))], {cwd: root, encoding: 'utf8', timeout: 5000});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Commit or resolve all changes/);
    await assert.rejects(readFile(join(root, '.git/index')), {code: 'ENOENT'});
  } finally { await rm(root, {recursive: true, force: true}); }
});
