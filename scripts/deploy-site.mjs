import {execFileSync} from 'node:child_process';
import {cp, lstat, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';
import {homedir, tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import {parseArgs} from 'node:util';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const apps = new Set(['abc-garden', 'reading-garden', 'math-garden']);

export async function inventory(directory, prefix = '') {
  const files = {};
  for (const name of (await readdir(join(directory, prefix))).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(prefix, name), info = await lstat(join(directory, path));
    if (info.isSymbolicLink()) throw Error(`Refuse symlink: ${path}`);
    if (info.isDirectory()) Object.assign(files, await inventory(directory, path));
    else if (info.isFile()) files[path] = digest(await readFile(join(directory, path)));
    else throw Error(`Not a regular file: ${path}`);
  }
  return files;
}

export async function prepareSite(root, output, sourceCommit, dirty) {
  const {name: app} = JSON.parse(await readFile(join(root, 'package.json')));
  if (!apps.has(app)) throw Error('Unknown Garden project.');
  const source = join(root, 'dist');
  const before = await inventory(source);
  for (const file of ['index.html', 'app/main.js', 'manifest.webmanifest', 'sw.js']) {
    if (!before[file]) throw Error(`Missing built file: ${file}`);
  }
  await cp(source, output, {recursive: true, filter: path => !basename(path).startsWith('.')});
  const files = await inventory(output);
  if (JSON.stringify(files) !== JSON.stringify(before) || JSON.stringify(await inventory(source)) !== JSON.stringify(before)) {
    throw Error('Build output changed while preparing deployment.');
  }
  const release = `${new Date().toISOString().replace(/[-:.]/g, '')}-${randomUUID().slice(0, 8)}`;
  const metadata = {app, release, sourceCommit, dirty, createdAt: new Date().toISOString()};
  const metadataBytes = JSON.stringify(metadata, null, 2) + '\n';
  await writeFile(join(output, '_release.json'), metadataBytes);
  files['_release.json'] = digest(metadataBytes);
  const manifest = JSON.stringify({app, release, files});
  await writeFile(join(output, '.deploy-manifest.json'), manifest);
  return {...metadata, manifestSha256: digest(manifest), fileCount: Object.keys(files).length};
}

export async function deploy(root = resolve('.')) {
  const {values} = parseArgs({options: {
    host: {type: 'string'}, key: {type: 'string'},
    'allow-dirty': {type: 'boolean'}, 'dry-run': {type: 'boolean'}, rollback: {type: 'boolean'},
  }});
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', env: {...process.env, GIT_OPTIONAL_LOCKS: '0'}}).trim();
  let dirty = Boolean(git(['status', '--porcelain']));
  if (!values.rollback && dirty && !values['allow-dirty']) throw Error('Commit or resolve all changes before publishing, or explicitly use --allow-dirty for an approved working tree.');
  if (!values.rollback && git(['branch', '--show-current']) !== 'main') throw Error('Publish from main only.');
  const {name: app} = JSON.parse(await readFile(join(root, 'package.json')));
  if (!apps.has(app)) throw Error('Unknown Garden project.');
  const host = values.host || process.env.GARDEN_DEPLOY_HOST || 'garden-deploy@106.15.155.26';
  if (!/^[a-z_][a-z0-9_-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host)) throw Error('Invalid SSH user@host.');
  const key = resolve(values.key || process.env.GARDEN_DEPLOY_KEY || join(homedir(), '.ssh/garden_deploy_nmwei'));
  const sshArgs = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-i', key];
  const run = (command, args, options = {}) => execFileSync(command, args, {
    cwd: root, stdio: options.input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'], ...options,
  });
  const remote = await readFile(new URL('./publish-site.py', import.meta.url), 'utf8');
  if (values.rollback) {
    if (values['dry-run']) throw Error('--rollback cannot be combined with --dry-run.');
    run('ssh', [...sshArgs, host, `python3 - ${quote(app)} rollback`], {input: remote});
    return;
  }
  const sourceCommit = git(['rev-parse', 'HEAD']);
  run(process.execPath, ['scripts/build.mjs']);
  dirty = Boolean(git(['status', '--porcelain']));
  if (dirty && !values['allow-dirty']) throw Error('Build changed the source tree; review it before publishing.');
  const temp = await mkdtemp(join(tmpdir(), `${app}-deploy-`));
  try {
    const site = join(temp, 'site');
    const release = await prepareSite(root, site, sourceCommit, dirty);
    if (git(['rev-parse', 'HEAD']) !== sourceCommit) throw Error('Source commit changed during deployment preparation.');
    if (values['dry-run']) {
      console.log(JSON.stringify({...release, action: 'validated; no upload or activation'}, null, 2));
      return;
    }
    const target = `/srv/gardens/sites/${app}/releases/${release.release}`;
    run('ssh', [...sshArgs, host, `mkdir -p ${quote(target)}`]);
    // Only the new, unique release directory is synchronized. Never write through current.
    const transport = ['ssh', ...sshArgs].map(quote).join(' ');
    run('rsync', ['-az', '--checksum', '--delete', '--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r',
      `--link-dest=/srv/gardens/sites/${app}/current`, '-e', transport, `${site}/`, `${host}:${target}/`]);
    run('ssh', [...sshArgs, host, `python3 - ${quote(app)} ${quote(release.release)} ${quote(release.manifestSha256)}`], {input: remote});
    console.log(`Published https://nmwei.cn/${app}/ · ${release.release}${dirty ? ' (approved working tree)' : ''}`);
  } finally {
    await rm(temp, {recursive: true, force: true});
  }
}
