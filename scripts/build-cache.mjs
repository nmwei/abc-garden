import {mkdir,readdir,lstat,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const signature=s=>[s.size,s.mtimeMs,s.ctimeMs,s.ino].join(':');
const digest=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
// Both source and destination must be unchanged before reusing validated metadata.
export async function syncBuild(source,out,cacheFile,{clean=false}={}){
 let previous={};if(!clean)try{previous=JSON.parse(await readFile(cacheFile,'utf8'));}catch{}
 if(clean)await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 const entries={},stats={copied:0,reused:0};
 async function visit(relative){
  const src=join(source,relative),dest=join(out,relative),s=await lstat(src);
  if(s.isSymbolicLink())throw Error(`Refuse symlink: ${src}`);
  if(s.isDirectory()){
   try{if(!(await lstat(dest)).isDirectory())await rm(dest,{force:true});}catch(e){if(e.code!=='ENOENT')throw e;}
   await mkdir(dest,{recursive:true});const names=await readdir(src);
   for(const name of await readdir(dest))if(!names.includes(name))await rm(join(dest,name),{recursive:true,force:true});
   for(const name of names)await visit(join(relative,name));return;
  }
  if(!s.isFile())throw Error(`Not a regular file: ${src}`);
  let d;try{d=await lstat(dest);}catch(e){if(e.code!=='ENOENT')throw e;}
  const old=previous[relative];
  if(old&&old.source===signature(s)&&d?.isFile()&&old.destination===signature(d)){entries[relative]=old;stats.reused++;return;}
  const bytes=await readFile(src);
  if(d)await rm(dest,{recursive:true,force:true});
  await copyFile(src,dest);stats.copied++;
  entries[relative]={source:signature(s),destination:signature(await lstat(dest)),bytes:bytes.length,sha256:digest(bytes),gitBlobSha1:digest(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes]),'sha1'),pcm16:bytes.length>=100&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.readUInt16LE(20)===1&&bytes.readUInt16LE(34)===16};
 }
 const roots=['index.html','manifest.webmanifest','app','assets'];
 for(const name of await readdir(out))if(!roots.includes(name))await rm(join(out,name),{recursive:true,force:true});
 for(const root of roots)await visit(root);
 return {entries,stats,save:async()=>{await mkdir(join(cacheFile,'..'),{recursive:true});await writeFile(cacheFile,JSON.stringify(entries));}};
}
