import {readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
// git() is bound to a temporary bare repository: never touch the source index.
export async function snapshotTree(directory,git){
 const paths=[];
 async function walk(relative=''){for(const name of (await readdir(join(directory,relative))).sort()){
  const path=relative?`${relative}/${name}`:name,info=await lstat(join(directory,path));
  if(info.isSymbolicLink())throw Error(`Refuse symlink: ${path}`);
  if(info.isDirectory())await walk(path);else if(info.isFile())paths.push(path);else throw Error(`Not a regular file: ${path}`);
 }}
 await walk();git(['read-tree','--empty']);
 if(paths.length){
  // Git's quoted-path syntax accepts these escapes, including spaces and newlines.
  const quote=p=>'"'+p.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t')+'"';
  const hashes=git(['hash-object','-w','--stdin-paths'],paths.map(p=>quote(resolve(directory,p))).join('\n')+'\n').trim().split('\n');
  if(hashes.length!==paths.length)throw Error('Incomplete snapshot hashes');
  git(['update-index','-z','--index-info'],paths.map((p,i)=>`100644 ${hashes[i]}\t${p}\0`).join(''));
 }
 return git(['write-tree']);
}
