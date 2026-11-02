import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {syncBuild} from '../scripts/build-cache.mjs';import {snapshotTree} from '../scripts/publish-tree.mjs';
test('incremental build reuses, repairs corruption, removes deleted files and matches clean output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'garden-build-'));try{
 const src=join(root,'src'),out=join(root,'out'),cache=join(root,'cache/files.json');await mkdir(join(src,'assets'),{recursive:true});await mkdir(join(src,'app'));for(const p of ['index.html','manifest.webmanifest','app/a.js','assets/a.wav'])await writeFile(join(src,p),'initial');
 let b=await syncBuild(src,out,cache);await b.save();assert.equal(b.stats.copied,4);
 b=await syncBuild(src,out,cache);assert.equal(b.stats.reused,4);await b.save();
 await writeFile(join(out,'assets/a.wav'),'corrupt');await writeFile(join(src,'app/a.js'),'updated');await rm(join(src,'manifest.webmanifest'));await writeFile(join(src,'manifest.webmanifest'),'new manifest');await writeFile(join(src,'assets/new'),'new');
 b=await syncBuild(src,out,cache);await b.save();assert.equal(await readFile(join(out,'assets/a.wav'),'utf8'),'initial');
 await rm(join(src,'assets/new'));b=await syncBuild(src,out,cache);await b.save();await assert.rejects(readFile(join(out,'assets/new')));
 const warm=b.entries,clean=await syncBuild(src,out,cache,{clean:true});for(const p of Object.keys(warm))assert.equal(warm[p].sha256,clean.entries[p].sha256);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('batched snapshot handles quoted paths and deletions, refuses symlinks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'garden-tree-'));try{const repo=join(root,'repo'),site=join(root,'site');await mkdir(site);execFileSync('git',['init','--bare','--quiet',repo]);const git=(args,input)=>execFileSync('git',['--git-dir',repo,...args],{input,encoding:'utf8'}).trim();
 const name='a space "中文"\n.txt';await writeFile(join(site,name),'hello');const tree=await snapshotTree(site,git);assert.equal(git(['show',`${tree}:${name}`]),'hello');await rm(join(site,name));assert.notEqual(await snapshotTree(site,git),tree);await symlink('/tmp',join(site,'link'));await assert.rejects(snapshotTree(site,git),/symlink/);
 }finally{await rm(root,{recursive:true,force:true});}
});
