import {
  mkdir,
  readdir,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const target = process.argv[2];
if (!target) throw new Error("请指定新的服务端发布目录");
const output = resolve(target);
await mkdir(output, { recursive: false, mode: 0o700 });
await mkdir(join(output, "server"));
await mkdir(join(output, "web/app"), { recursive: true });
const paths = (await readdir("server"))
  .filter(
    (name) =>
      name.endsWith(".mjs") ||
      ["package.json", "package-lock.json"].includes(name),
  )
  .map((name) => `server/${name}`);
// Package the pure contract dependency graph, not a second handwritten file list.
const collected=new Set();
async function collect(path) {
  if(collected.has(path)) return;
  if(!path.startsWith('web/app/') || !path.endsWith('.js')) throw Error('Unexpected shared dependency: '+path);
  collected.add(path);
  const source=await readFile(path,'utf8');
  for(const match of source.matchAll(/^import\s+(?:[\w$*{},\s]+\s+from\s*)?['"]([^'"]+)['"]|^export\s+(?:\{[^}]*\}|\*)\s+from\s*['"]([^'"]+)['"]/gm)) {
    const dependency=match[1]||match[2];
    if(!dependency.startsWith('.')) throw Error('Shared contract must use local modules: '+path);
    const next=resolve(path,'..',dependency);
    await collect(next.slice(resolve('.').length+1));
  }
  paths.push(path);
}
await collect('web/app/archive-schema.js');
const hashes = {};
for (const path of paths) {
  const body = await readFile(path);
  hashes[path] = createHash("sha256").update(body).digest("hex");
  await copyFile(path, join(output, path));
}
const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  }).trim();
await writeFile(
  join(output, "release.json"),
  JSON.stringify(
    {
      sourceCommit: git(["rev-parse", "HEAD"]),
      dirty: Boolean(git(["status", "--porcelain"])),
      createdAt: new Date().toISOString(),
      files: hashes,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Server package prepared in ${output}`);
